import type { ReactNode } from "react";
import type { TabName } from "../../lib/types";

interface ViewPanelProps {
  name: TabName;
  activeTab: TabName;
  children: ReactNode;
}

function ViewPanel({ name, activeTab, children }: ViewPanelProps) {
  return (
    <div className={`view ${activeTab === name ? "active" : ""}`}>
      {children}
    </div>
  );
}

type NamedViewProps = Omit<ViewPanelProps, "name">;

export const DashboardView = (props: NamedViewProps) => (
  <ViewPanel name="dashboard" {...props} />
);
export const InventoryView = (props: NamedViewProps) => (
  <ViewPanel name="inventory" {...props} />
);
export const SaleView = (props: NamedViewProps) => (
  <ViewPanel name="sale" {...props} />
);
export const SalesLogView = (props: NamedViewProps) => (
  <ViewPanel name="sales-log" {...props} />
);
export const DebtsView = (props: NamedViewProps) => (
  <ViewPanel name="debts" {...props} />
);
export const QuickSaleView = (props: NamedViewProps) => (
  <ViewPanel name="quick-sale" {...props} />
);
export const ReportsView = (props: NamedViewProps) => (
  <ViewPanel name="reports" {...props} />
);
