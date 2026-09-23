// Диспетчер+реекспорт (Task 7, рішення Task 6 Step 5): exports-мапа пакета
// несе `./admin/pages/*`, але не `./admin/features/*` — роут
// (`routes/admin/admin/products/$productId.tsx`) не може імпортувати
// `admin/features/*` напряму, тож новий/існуючий товар розводить ЦЕЙ файл.
import { useParams } from '@tanstack/react-router';
import { NewProductPage } from '../features/products/edit/NewProductPage';
import { ProductEditPage } from '../features/products/edit/ProductEditPage';

export default function ProductEditRoute() {
  const { productId } = useParams({ strict: false }) as { productId: string };
  return productId === 'new' ? (
    <NewProductPage />
  ) : (
    <ProductEditPage productId={productId} />
  );
}
