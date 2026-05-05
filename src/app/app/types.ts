export type MainTab = 'products' | 'orders' | 'sell' | 'search';

export type ProductCategory =
  | 'Electronics'
  | 'Fashion'
  | 'Home'
  | 'Food'
  | 'Health'
  | 'Sports'
  | 'Books'
  | 'Art'
  | 'Services'
  | 'Other';

export type ProductCondition = 'new' | 'used' | 'refurbished';

export interface ShippingInfo {
  country:       string;
  city:          string;
  shipsTo:       string[];
  shippingCost:  number;
  estimatedDays: string;
}

export interface SellerContact {
  whatsapp?: string;
  telegram?: string;
  email?:    string;
}

export interface Product {
  id:            string;
  title:         string;
  description:   string;
  price:         number;
  stock:         number;
  category:      ProductCategory;
  images:        string[];
  sellerId:      string;
  sellerName?:   string;
  shipping:      ShippingInfo;
  contact:       SellerContact;
  rating:        number;
  reviewCount:   number;
  warranty?:     string;
  returnPolicy?: string;
  condition:     ProductCondition;
  createdAt:     string;
}

export interface Review {
  id:        string;
  userId:    string;
  username:  string;
  rating:    number;
  comment:   string;
  createdAt: string;
}

export interface Order {
  id:         string;
  product_id: string;
  product?:   Product;
  buyer_id:   string;
  status:     'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total:      number;
  payment_id?: string;
  txid?:      string;
  createdAt:  string;
  review?:    Review;
}

export const CATEGORIES: ProductCategory[] = [
  'Electronics', 'Fashion', 'Home', 'Food',
  'Health', 'Sports', 'Books', 'Art', 'Services', 'Other',
];

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  Electronics: '📱',
  Fashion:     '👗',
  Home:        '🏠',
  Food:        '🍔',
  Health:      '💊',
  Sports:      '⚽',
  Books:       '📚',
  Art:         '🎨',
  Services:    '🛠️',
  Other:       '📦',
};

export const COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar',
  'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Morocco',
  'Tunisia', 'Algeria', 'Libya', 'Sudan', 'Iraq',
  'Palestine', 'Yemen', 'Syria', 'USA', 'UK',
  'Germany', 'France', 'Turkey', 'Pakistan', 'India',
  'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Other',
];

export const STATUS_COLORS: Record<Order['status'], string> = {
  pending:   '#f0c040',
  confirmed: '#7eb8f7',
  shipped:   '#b39ddb',
  delivered: '#7ee7c0',
  cancelled: '#e74c3c',
  refunded:  '#ff9800',
};
