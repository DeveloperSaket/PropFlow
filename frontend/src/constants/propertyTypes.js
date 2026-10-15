export const PROPERTY_TYPES = [
  { value: 'detached', label: 'Detached' },
  { value: 'semi_detached', label: 'Semi-detached' },
  { value: 'freehold_townhouse', label: 'Freehold townhouse' },
  { value: 'condo_townhouse', label: 'Condo townhouse' },
  { value: 'condo_apt', label: 'Condo apt' },
  { value: 'link', label: 'Link' },
  { value: 'vacant_land', label: 'Vacant land' },
  { value: 'other', label: 'Other' },
];

const LEGACY_PROPERTY_TYPE_LABELS = {
  apartment: 'Apartment',
  house: 'House',
  plot: 'Plot',
  commercial: 'Commercial',
  villa: 'Villa',
};

export function getPropertyTypeLabel(value) {
  return PROPERTY_TYPES.find((type) => type.value === value)?.label
    || LEGACY_PROPERTY_TYPE_LABELS[value]
    || value;
}