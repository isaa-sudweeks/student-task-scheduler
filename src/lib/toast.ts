import { toast as hotToast } from "react-hot-toast";

const base = { duration: 3500 } as const;

function show(type: "success" | "error" | "info", message: string) {
  hotToast.dismiss();
  if (type === "success") return hotToast.success(message, base);
  if (type === "error") return hotToast.error(message, base);
  return hotToast(message, base);
}

export const toast = {
  success: (msg: string) => show("success", msg),
  error: (msg: string) => show("error", msg),
  info: (msg: string) => show("info", msg),
};

export default toast;
