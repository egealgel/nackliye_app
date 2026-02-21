export type VehicleType = 'minivan' | 'kamyonet' | 'kamyon' | 'tir' | 'damperli';

export type LoadFormData = {
  fromCity: string;
  fromDistrict: string;
  toCity: string;
  toDistrict: string;
  weight: number;
  width?: number;
  length?: number;
  height?: number;
  vehicleType: VehicleType;
  photos: string[];
  description: string;
};

export const VEHICLE_WEIGHT_LIMITS: Record<VehicleType, number> = {
  minivan: 800,
  kamyonet: 3500,
  kamyon: 12000,
  tir: 25000,
  damperli: Infinity,
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  minivan: 'Minivan',
  kamyonet: 'Kamyonet',
  kamyon: 'Kamyon',
  tir: 'Tır',
  damperli: 'Damperli',
};

export const VEHICLE_ICONS: Record<VehicleType, string> = {
  minivan: 'van-utility',
  kamyonet: 'truck',
  kamyon: 'truck-cargo-container',
  tir: 'truck-trailer',
  damperli: 'dump-truck',
};

export function suggestVehicleType(weightKg: number): VehicleType {
  if (weightKg <= 800) return 'minivan';
  if (weightKg <= 3500) return 'kamyonet';
  if (weightKg <= 12000) return 'kamyon';
  if (weightKg <= 25000) return 'tir';
  return 'damperli';
}

export function isVehicleCompatible(vehicleType: VehicleType, weightKg: number): boolean {
  return weightKg <= VEHICLE_WEIGHT_LIMITS[vehicleType];
}

export function formatWeight(kg: number): string {
  if (kg >= 1000) {
    const tons = kg / 1000;
    return `${tons % 1 === 0 ? tons.toFixed(0) : tons.toFixed(1)} ton`;
  }
  return `${kg} kg`;
}

export function formatRoute(
  fromCity: string,
  fromDistrict: string,
  toCity: string,
  toDistrict: string,
): string {
  return `${fromCity}/${fromDistrict} → ${toCity}/${toDistrict}`;
}
