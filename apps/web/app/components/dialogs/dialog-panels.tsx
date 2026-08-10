import type { ReactNode } from "react";
import type { ModalName } from "../../lib/types";

interface DialogPanelProps {
  name: ModalName;
  activeModal: ModalName | null;
  children: ReactNode;
}

function DialogPanel({ name, activeModal, children }: DialogPanelProps) {
  return (
    <div className={`modal-backdrop ${activeModal === name ? "active" : ""}`}>
      {children}
    </div>
  );
}

type NamedDialogProps = Omit<DialogPanelProps, "name">;

export const ProductDialog = (props: NamedDialogProps) => (
  <DialogPanel name="product" {...props} />
);
export const CheckoutDialog = (props: NamedDialogProps) => (
  <DialogPanel name="checkout" {...props} />
);
export const CancelCheckoutDialog = (props: NamedDialogProps) => (
  <DialogPanel name="confirm-cancel" {...props} />
);
export const ReceiptDialog = (props: NamedDialogProps) => (
  <DialogPanel name="receipt" {...props} />
);
export const StaffDialog = (props: NamedDialogProps) => (
  <DialogPanel name="user" {...props} />
);
export const SettingsDialog = (props: NamedDialogProps) => (
  <DialogPanel name="settings" {...props} />
);
export const DebtPaymentDialog = (props: NamedDialogProps) => (
  <DialogPanel name="payment" {...props} />
);
