import { toast as hotToast } from "react-hot-toast";

const base = { duration: 3500 } as const;

function show(
  type: "success" | "error" | "info",
  message: string,
  dismissAll = true,
) {
  if (dismissAll) hotToast.dismiss();
  if (type === "success") return hotToast.success(message, base);
  if (type === "error") return hotToast.error(message, base);
  return hotToast(message, base);
}

export const toast = {
  success: (msg: string, dismissAll = true) => show("success", msg, dismissAll),
  error: (msg: string, dismissAll = true) => show("error", msg, dismissAll),
  info: (msg: string, dismissAll = true) => show("info", msg, dismissAll),
};

export const dismissAll = () => hotToast.dismiss();

export default toast;
