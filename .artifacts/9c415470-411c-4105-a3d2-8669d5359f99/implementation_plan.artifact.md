# Final Integration & DB/Media Connectivity Plan

This plan outlines the steps to finalize the GrabIt mobile application by ensuring live database connectivity, consistent media loading from Cloudinary, and a comprehensive audit of all workflows.

## User Review Required

> [!IMPORTANT]
> The `API_BASE_URL` in `services/api.ts` is currently set to `http://10.0.2.2:8000/api` for the Android Emulator. If you are testing on a physical device, please ensure the backend is accessible over your local network and update the IP address accordingly.

## Proposed Changes

### 1. Database Connectivity (DB Provider)

Connect all major UI sections to the FastAPI/Supabase backend to replace static demo data.

#### [MODIFY] [CustomerHomeScreen (index.tsx)](file:///C:/Users/HP/OneDrive/Desktop/KSS-GRAB-Mobile-main/mobile/app/customer/index.tsx)
- Add `useEffect` to fetch `categories` and `popularProducts` from the API.
- Implement `RefreshControl` to allow users to pull-to-refresh the catalog.

#### [MODIFY] [CategoryProductsPage ([slug].tsx)](file:///C:/Users/HP/OneDrive/Desktop/KSS-GRAB-Mobile-main/mobile/app/customer/category/[slug].tsx)
- Ensure robust error handling and fallback to an empty state if the API fails.

---

### 2. Media Provider Integration (Cloudinary)

Ensure all images are loaded through the Cloudinary provider with proper formatting.

#### [NEW] [cloudinary.ts](file:///C:/Users/HP/OneDrive/Desktop/KSS-GRAB-Mobile-main/mobile/services/cloudinary.ts)
- Create a utility to transform local/relative paths into Cloudinary URLs if needed.
- Handle fallback images for broken URLs.

#### [MODIFY] [ProductCard.tsx](file:///C:/Users/HP/OneDrive/Desktop/KSS-GRAB-Mobile-main/mobile/components/ProductCard.tsx)
- Use the Cloudinary utility for product images.
- Add support for different image transformations (thumbnails vs high-res).

---

### 3. Workflow Audit & Testing

Perform a full sweep of the application to ensure all buttons and transitions work.

#### Workflow: Auth & Profile
- Verify Login -> OTP -> Profile Completion -> Home flow.
- Test "Skip Login" guest mode.
- Test "Switch Portal" (Seller/Rider/Admin) links.

#### Workflow: Catalog & Search
- Test category navigation.
- Test search functionality and sorting.

#### Workflow: Order Lifecycle
- Test Add to Cart -> Checkout -> Place Order.
- Verify real-time order tracking with WebSockets (if applicable).
- Test order cancellation.

---

### 4. Run Application

- Final build verification using `npx tsc --noEmit`.
- Instructions to run the application via Expo.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` to check for type/syntax errors.

### Manual Verification
- Navigate through all bottom tabs (Home, Categories, Orders, Profile).
- Place a test order and verify it appears in the "Orders" tab.
- Check if images load correctly on both Home and Product Detail screens.
