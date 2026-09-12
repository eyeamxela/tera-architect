'use client';
import { PRODUCT_NAME } from './product';
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react';
export const brand = {
  name: PRODUCT_NAME,
  descriptor: 'PROJECTS & CLIENTS',
  studio: 'Example Studio',
  lead: 'Project team',
};
export type Brand = typeof brand;
const BrandContext = createContext(brand);
export const useBrand = () => useContext(BrandContext);
export function BrandProvider({
  value,
  children,
}: {
  value: Brand;
  children: ReactNode;
}) {
  return createElement(
    BrandContext.Provider,
    { value: { ...value, name: PRODUCT_NAME } },
    children,
  );
}
