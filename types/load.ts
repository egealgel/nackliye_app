export type VehicleType = 'minivan' | 'kamyonet' | 'kamyon' | 'tir' | 'damperli';

export type PhotoItem = {
  uri: string;
  status: 'uploading' | 'done' | 'error';
  url?: string;
};

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
  photos: PhotoItem[];
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

// --- DB row types ---

export type LoadRow = {
  id: string;
  user_id: string;
  from_city: string;
  from_district: string;
  to_city: string;
  to_district: string;
  weight_kg: number;
  width_cm: number | null;
  height_cm: number | null;
  length_cm: number | null;
  vehicle_type: string;
  photos: string[] | null;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
};

export type ProfileSnippet = {
  id: string;
  name: string;
  phone: string;
  rating_avg?: number | null;
};

export type LoadWithDetails = LoadRow & {
  ownerName: string;
  ownerPhone: string;
  ownerRatingAvg?: number | null;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedDriverRatingAvg?: number | null;
};

export type MessageSender = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: string | null;
  ratingAvg?: number | null;
  city?: string;
  /** User sent at least one regular message (text/image/document/system) for this load */
  hasMessage: boolean;
  /** User tapped Ara (call) at least once for this load */
  hasCallAttempt: boolean;
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Az önce';
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  return `${day} gün`;
}

export const ROOM_LIST: {
  type: VehicleType;
  label: string;
  range: string;
  icon: string;
  color: string;
  bg: string;
}[] = [
  { type: 'minivan', label: 'Minivan', range: '0-800 kg', icon: 'van-utility', color: '#4CAF50', bg: '#E8F5E9' },
  { type: 'kamyonet', label: 'Kamyonet', range: '0-3.5t', icon: 'truck-outline', color: '#2196F3', bg: '#E3F2FD' },
  { type: 'kamyon', label: 'Kamyon', range: '0-12t', icon: 'truck', color: '#FF6B35', bg: '#FFF0E8' },
  { type: 'tir', label: 'Tır', range: '0-25t', icon: 'truck-trailer', color: '#9C27B0', bg: '#F3E5F5' },
  { type: 'damperli', label: 'Damperli', range: '25t+', icon: 'dump-truck', color: '#F44336', bg: '#FFEBEE' },
];
