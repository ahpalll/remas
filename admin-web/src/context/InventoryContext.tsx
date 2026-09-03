import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Book, BookSale, InventoryItem, InventoryReturn, Purchase, StockMovement, StudentBookDelivery, Supplier } from '../types/inventory';

export interface InventoryContextType {
  books: Book[];
  suppliers: Supplier[];
  purchases: Purchase[];
  sales: BookSale[];
  deliveries: StudentBookDelivery[];
  returns: InventoryReturn[];
  stockMovements: StockMovement[];
  inventoryItems: InventoryItem[];
  loading: boolean;
  error: string | null;
  refreshInventoryCore: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<BookSale[]>([]);
  const [deliveries, setDeliveries] = useState<StudentBookDelivery[]>([]);
  const [returns, setReturns] = useState<InventoryReturn[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryCore = async () => {
    if (!currentUser || !institutionId) {
      setBooks([]);
      setSuppliers([]);
      setPurchases([]);
      setSales([]);
      setDeliveries([]);
      setReturns([]);
      setStockMovements([]);
      setInventoryItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const getCollectionDocs = async <T,>(colName: string): Promise<T[]> => {
        const ref = collection(db, 'institutions', institutionId, colName);
        const snap = await getDocs(query(ref));
        const items: T[] = [];
        snap.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });
        return items;
      };

      const [booksData, suppliersData, purchasesData, salesData, deliveriesData, returnsData, movementsData, inventoryData] = await Promise.all([
        getCollectionDocs<Book>('books'),
        getCollectionDocs<Supplier>('suppliers'),
        getCollectionDocs<Purchase>('purchases'),
        getCollectionDocs<BookSale>('sales'),
        getCollectionDocs<StudentBookDelivery>('studentDeliveries'),
        getCollectionDocs<InventoryReturn>('returns'),
        getCollectionDocs<StockMovement>('stockMovements'),
        getCollectionDocs<InventoryItem>('inventory'),
      ]);

      setBooks(booksData);
      setSuppliers(suppliersData);
      setPurchases(purchasesData);
      setSales(salesData);
      setDeliveries(deliveriesData);
      setReturns(returnsData);
      setStockMovements(movementsData);
      setInventoryItems(inventoryData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الكتب والمخزون.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryCore();
  }, [currentUser, institutionId]);

  const value = {
    books,
    suppliers,
    purchases,
    sales,
    deliveries,
    returns,
    stockMovements,
    inventoryItems,
    loading,
    error,
    refreshInventoryCore: fetchInventoryCore,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextType {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
