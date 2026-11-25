export const barberBrand = 'Da Barber Anas';

export function barberName(name?: string) {
  return !name || name === 'Anas Barber' ? barberBrand : name;
}
