/** Mirrors backend AddressDto (pratik-dairy-user / dto/AddressDto.java). */
export interface AddressDto {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}