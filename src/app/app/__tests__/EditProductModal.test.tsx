import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditProductModal } from '../components/EditProductModal';
import type { Product } from '../types';

const mockProduct: Product = {
  id:          'prod-1',
  title:       'Test Product',
  description: 'A test product',
  price:       5,
  stock:       10,
  category:    'electronics',
  images:      ['https://example.com/img1.jpg'],
  sellerId:    'seller-1',
  sellerName:  'Test Seller',
  shipping:    { country: 'US', city: 'NYC', shipsTo: ['US'], shippingCost: 0, estimatedDays: '3-5' },
  contact:     { whatsapp: '+1234567890', telegram: '@seller', email: 'seller@example.com' },
  rating:      4.5,
  reviewCount: 10,
  warranty:    '1 year',
  returnPolicy: '30 days',
  condition:   'new',
  createdAt:   '2026-01-01T00:00:00Z',
};

describe('EditProductModal', () => {
  const onClose   = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=test-token; tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
  });

  it('renders modal with product title', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByDisplayValue('Test Product')).toBeTruthy();
  });

  it('renders price and stock fields', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByDisplayValue('5')).toBeTruthy();
    expect(screen.getByDisplayValue('10')).toBeTruthy();
  });

  it('renders contact info fields', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByDisplayValue('+1234567890')).toBeTruthy();
    expect(screen.getByDisplayValue('@seller')).toBeTruthy();
    expect(screen.getByDisplayValue('seller@example.com')).toBeTruthy();
  });

  it('renders shipping fields', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByDisplayValue('NYC')).toBeTruthy();
    expect(screen.getByDisplayValue('US')).toBeTruthy();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    const cancelBtn = screen.getByText(/cancel/i);
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders product without optional fields gracefully', () => {
    const minimalProduct: Product = {
      ...mockProduct,
      warranty:    undefined,
      returnPolicy: undefined,
      shipping:    {},
      contact:     {},
      images:      [],
    };
    render(<EditProductModal product={minimalProduct} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByDisplayValue('Test Product')).toBeTruthy();
  });

  it('shows image thumbnail for existing images', () => {
    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('img1.jpg');
  });

  it('submits form and calls fetch on save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ data: { ...mockProduct, title: 'Updated' } }),
    } as Response);

    render(<EditProductModal product={mockProduct} onClose={onClose} onSuccess={onSuccess} />);

    const saveBtn = screen.getByText(/save/i);
    fireEvent.click(saveBtn);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bff/commerce/products'),
      expect.objectContaining({ method: expect.stringMatching(/PUT|PATCH/) }),
    );
  });
});
