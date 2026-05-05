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

export interface ShippingInfo {
  country:         string;
  city:            string;
  shipsTo:         string[];
  shippingCost:    number;
  estimatedDays:   string;
}

export interface SellerContact {
  whatsapp?:  string;
  telegram?:  string;
  email?:     string;
}

export interface Product {
  id:           string;
  title:        string;
  description:  string;
  price:        number;
  stock:        number;
  category:     ProductCategory;
  images:       string[];
  sellerId:     string;
  sellerName?:  string;
  shipping:     ShippingInfo;
  contact:      SellerContact;
  rating:       number;
  reviewCount:  number;
  warranty?:    string;
  returnPolicy?: string;
  condition:    'new' | 'used' | 'refurbished';
  createdAt:    string;
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
  id:          string;
  product_id:  string;
  product?:    Product;
  buyer_id:    string;
  status:      'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total:       number;
  payment_id?: string;
  txid?:       string;
  createdAt:   string;
  review?:     Review;
}
