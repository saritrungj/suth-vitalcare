import Swal from "sweetalert2";
/**
 * Premium SweetAlert2 instance with custom styling
 */
export const swal = Swal.mixin({
  customClass: {
    confirmButton: "premium-swal-confirm",
    cancelButton: "premium-swal-cancel",
    popup: "premium-swal-popup",
    title: "premium-swal-title",
    htmlContainer: "premium-swal-text",
  },
  buttonsStyling: false,
  confirmButtonText: "ตกลง",
  cancelButtonText: "ยกเลิก",
  heightAuto: false,
  showCloseButton: true,
});
/**
 * Quick success alert
 */
export const showSuccess = (title: string, text?: string) => {
  return swal.fire({
    icon: "success",
    title,
    text,
    timer: 3500,
    showConfirmButton: true,
    iconColor: "#1d9e75",
  });
};
/**
 * Quick error alert
 */
export const showError = (title: string, text?: string) => {
  return swal.fire({
    icon: "error",
    title,
    text,
    iconColor: "#ef4444",
  });
};
/**
 * Confirm dialog
 */
export const showConfirm = (
  title: string,
  text?: string,
  confirmText: string = "ตกลง",
  type: "warning" | "error" | "info" | "question" = "question",
  isDanger: boolean = false,
) => {
  return swal
    .fire({
      title,
      text,
      icon: type,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: "ยกเลิก",
      iconColor:
        type === "error"
          ? "#ef4444"
          : type === "warning"
            ? "#f59e0b"
            : type === "info"
              ? "#3b82f6"
              : "#6366f1",
      customClass: {
        popup: "premium-swal-popup",
        title: "premium-swal-title",
        htmlContainer: "premium-swal-text",
        confirmButton: isDanger
          ? "premium-swal-confirm premium-swal-confirm-danger"
          : "premium-swal-confirm",
        cancelButton: "premium-swal-cancel",
      },
    })
    .then((result) => result.isConfirmed);
};
export default swal;
