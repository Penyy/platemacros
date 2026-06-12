import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        style: {
          background: "#211F19",
          color: "#F5F1E8",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "18px",
          fontFamily: "Manrope, sans-serif",
          fontWeight: 700,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          marginLeft: "16px",
          marginRight: "16px",
          width: "auto",
        },
        actionButtonStyle: {
          background: "transparent",
          color: "#F4B500",
          fontWeight: 800,
        },
        classNames: {
          description: "group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
