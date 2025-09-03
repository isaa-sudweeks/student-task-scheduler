# Google Cloud Deployment Guide

This guide outlines how to deploy the Student Task Scheduler to Google Cloud Platform (GCP) using Cloud Run and GitHub Actions.

## 1. Prerequisites

1. **Google Cloud project** with billing enabled.
2. **gcloud CLI** installed locally for one-time setup.
3. **GitHub repository** containing this codebase with admin access.

## 2. Enable Required APIs

Enable these services in your GCP project:

- Cloud Run
- Artifact Registry
- Cloud Build
- Cloud SQL Admin
- Secret Manager
- IAM Service Account Credentials

```bash
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com
```

## 3. Create Cloud Resources

1. **Artifact Registry** (stores the container image):
   ```bash
   gcloud artifacts repositories create scheduler-repo \
     --repository-format=docker \
     --location=us-central1
   ```

2. **Cloud SQL for PostgreSQL** (database):
   ```bash
   gcloud sql instances create scheduler-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1
   gcloud sql databases create scheduler --instance=scheduler-db
   gcloud sql users set-password postgres \
     --instance=scheduler-db --password=<STRONG_PASSWORD>
   ```

3. **(Optional) Memorystore for Redis** if you need a managed Redis:
   ```bash
   gcloud redis instances create scheduler-cache \
     --size=1 --region=us-central1
   ```

## 4. Service Accounts & Permissions

### Runtime Service Account

Create a service account for the Cloud Run service and grant it access to Cloud SQL and Secret Manager:

```bash
gcloud iam service-accounts create scheduler-run

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:scheduler-run@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:scheduler-run@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### GitHub Actions Service Account

This account allows GitHub Actions to push images and deploy:

```bash
gcloud iam service-accounts create github-deployer

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:github-deployer@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:github-deployer@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:github-deployer@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# download key
gcloud iam service-accounts keys create github-deployer.json \
  --iam-account=github-deployer@$GCP_PROJECT_ID.iam.gserviceaccount.com
```

Encode `github-deployer.json` in base64; this value will become the `GCP_SA_KEY` GitHub secret.

## 5. Environment Variables & Secrets

| Variable | Description | Where to Obtain |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Cloud SQL instance credentials. Example: `postgresql://postgres:<PASSWORD>@//cloudsql/<PROJECT>:<REGION>:scheduler-db/scheduler` when using the Cloud SQL Proxy. |
| `NEXTAUTH_SECRET` | Secret for encrypting NextAuth JWTs | Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Public base URL of your app | Cloud Run service URL after deployment, e.g. `https://scheduler-<hash>-uc.a.run.app`. |
| `GITHUB_ID` | GitHub OAuth client ID | From a GitHub OAuth app under Developer settings. |
| `GITHUB_SECRET` | GitHub OAuth client secret | Same as above. |
| `REDIS_URL` | Redis connection string | From Memorystore (`redis://<HOST>:6379`) or another provider. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for Calendar sync | Google Cloud Console → APIs & Services → Credentials. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Same as above. |

Store these values in **Secret Manager** (for runtime) and as **GitHub secrets** (for CI/CD).

## 6. Add GitHub Secrets

In the GitHub repository, navigate to **Settings → Secrets and variables → Actions** and create the following secrets:

| Secret Name | Value |
|---|---|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | Deployment region (e.g. `us-central1`) |
| `GCP_SA_KEY` | Base64-encoded contents of `github-deployer.json` |
| `DATABASE_URL` | Same as above |
| `NEXTAUTH_SECRET` | Same as above |
| `NEXTAUTH_URL` | Will be set after first deploy; placeholder initially |
| `GITHUB_ID` | OAuth client ID |
| `GITHUB_SECRET` | OAuth client secret |
| `REDIS_URL` | Redis connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## 7. GitHub Actions Workflow

Create `.github/workflows/deploy.yml` to build and deploy automatically:

```yaml
name: deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: "${{ secrets.GCP_SA_KEY }}"

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and push image
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev
          docker build -t ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/scheduler-repo/web:$GITHUB_SHA .
          docker push ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/scheduler-repo/web:$GITHUB_SHA

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy scheduler \
            --image ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/scheduler-repo/web:$GITHUB_SHA \
            --region ${{ secrets.GCP_REGION }} \
            --service-account scheduler-run@$GCP_PROJECT_ID.iam.gserviceaccount.com \
            --allow-unauthenticated \
            --set-secrets DATABASE_URL=${{ secrets.DATABASE_URL }}:latest,NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }}:latest,GITHUB_ID=${{ secrets.GITHUB_ID }}:latest,GITHUB_SECRET=${{ secrets.GITHUB_SECRET }}:latest,REDIS_URL=${{ secrets.REDIS_URL }}:latest,GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}:latest,GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}:latest \
            --set-env-vars NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}
```

After the first deployment, update the `NEXTAUTH_URL` secret with the actual Cloud Run URL shown by the deploy command.

## 8. Database Migration

Cloud Run containers should run migrations on startup. The Docker image already includes Prisma; ensure `npx prisma migrate deploy` (or `prisma db push` for non-migrations) executes before the server starts.

## 9. Accessing the App

Once deployed, Cloud Run will output a URL such as `https://scheduler-xxxxx-uc.a.run.app`. Use this value to update `NEXTAUTH_URL` in Secret Manager and GitHub secrets, then redeploy.

---

With these steps complete, the Student Task Scheduler will run on Google Cloud with automated deployments from GitHub.
