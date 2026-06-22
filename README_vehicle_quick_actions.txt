Vehicle Quick Actions Phase

Files included:
- src/components/vehicles/VehicleModernClient.tsx
- src/app/vehicles/[id]/page.tsx

What changed:
1. Pages can open create forms automatically from links like:
   /vehicle-accidents?vehicleId=VEHICLE_ID&openCreate=1
2. The selected vehicle auto-fills driver/city as already configured.
3. Vehicle table gets quick action buttons: حركة، صيانة، تفويض، حادث.
4. Related module rows show a link back to ملف السيارة when vehicleId exists.
5. Vehicle details page gets full quick action buttons: movement, maintenance, authorization, accident, damage, cleaning, violation, deduction.
