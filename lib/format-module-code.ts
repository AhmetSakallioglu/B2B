import { formatDimensionsWHD } from "@/lib/format-dimensions";

export type ModuleCodeInput = {
  productSku: string;
  color: string;
  widthIn: number;
  heightIn: number;
  depthIn: number;
};

export function formatModuleCode(item: ModuleCodeInput) {
  return `${item.productSku} - ${item.color} - ${formatDimensionsWHD(item.widthIn, item.heightIn, item.depthIn)}`;
}
