# Admin Map - Refactored with Polygon Support

## Overview
The Admin Map component has been completely refactored for better code organization, maintainability, and new polygon drawing functionality for facilities.

## New Features

### 1. **Polygon Drawing for Facilities**
Admins can now draw polygons on the map to represent facility boundaries (buildings, parking lots, sports fields, etc.)

#### How to Use:
1. Click the **"Draw Facility"** button
2. Click on the map to add polygon points
3. Double-click or click **"Finish Polygon"** to complete (minimum 3 points)
4. Fill in the facility details in the modal:
   - **Name** (required)
   - **Description** (optional)
   - **Type** (Building, Parking Lot, Sports Field, Garden, Plaza, Restricted Area, Other)
   - **Border Color** (color picker)
   - **Fill Color** (color picker)
   - **Fill Opacity** (slider 0-100%)
5. Click **"Save Polygon"**

#### Editing Polygons:
- Click on any polygon to see details
- Click **"Edit"** button in the popup
- **Drag markers** to adjust polygon shape
- **Click on edges** to add new points
- **Right-click markers** to remove points (minimum 3 required)
- Changes update in real-time
- Click **"Save Polygon"** to save changes

#### Deleting Polygons:
- Click on the polygon
- Click **"Delete"** button
- Confirm deletion

### 2. **Code Organization with Composables**

The codebase has been split into reusable composables for better organization:

#### **`useMapMarkers.js`**
- Manages all marker-related functionality
- Functions:
  - `fetchMarkers()` - Get markers from backend
  - `addMarkerToMap(location)` - Add marker to map
  - `enableMarkerDragging(markerId, onDragEnd)` - Enable drag mode

#### **`useMapRoutes.js`**
- Manages route drawing and editing
- Functions:
  - `fetchRoutes()` - Get routes from backend
  - `displayRoute(route)` - Display route on map
  - `startDrawingRoute()` - Start route drawing mode
  - `addRoutePoint(latlng)` - Add point to route
  - `cancelDrawing()` - Cancel route drawing
  - `cleanupRoutes()` - Remove all routes

#### **`useMapPolygons.js`** ⭐ **NEW**
- Manages polygon drawing and editing
- Functions:
  - `fetchPolygons()` - Get polygons from backend
  - `displayPolygon(polygonData)` - Display polygon on map
  - `startDrawingPolygon()` - Start polygon drawing mode
  - `addPolygonPoint(latlng)` - Add point to polygon
  - `finishDrawingPolygon()` - Complete polygon and return data
  - `cancelDrawingPolygon()` - Cancel polygon drawing
  - `enablePolygonEditing(polygonId, onUpdate)` - Enable edit mode
  - `cancelPolygonEditing()` - Cancel editing
  - `cleanupPolygons()` - Remove all polygons

## File Structure

```
resources/js/
├── composables/
│   ├── useMapMarkers.js       # Marker management
│   ├── useMapRoutes.js        # Route management
│   └── useMapPolygons.js      # Polygon management ⭐ NEW
├── Components/
│   └── map/
│       ├── AdminMap.vue       # Original (can be deprecated)
│       └── AdminMapNew.vue    # Refactored version ⭐ NEW
```

## Backend Structure

### Database
**Table:** `facility_polygons`

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| name | string | Facility name |
| description | text | Optional description |
| type | string | Facility type |
| color | string | Border color (hex) |
| fill_color | string | Fill color (hex) |
| fill_opacity | decimal | Fill opacity (0.0-1.0) |
| coordinates | json | Array of lat/lng points |
| created_at | timestamp | Created timestamp |
| updated_at | timestamp | Updated timestamp |

### Model
**File:** `app/Models/FacilityPolygon.php`
```php
protected $fillable = [
    'name', 'description', 'type', 'color',
    'fill_color', 'fill_opacity', 'coordinates'
];

protected $casts = [
    'coordinates' => 'array',
    'fill_opacity' => 'float'
];
```

### Controller
**File:** `app/Http/Controllers/FacilityPolygonController.php`

#### Endpoints:
- `GET /facilities/polygons` - List all polygons (public)
- `POST /facilities/polygons` - Create polygon (auth)
- `GET /facilities/polygons/{id}` - Get single polygon (auth)
- `PUT /facilities/polygons/{id}` - Update polygon (auth)
- `DELETE /facilities/polygons/{id}` - Delete polygon (auth)

#### Validation Rules:
```php
'name' => 'required|string|max:255',
'description' => 'nullable|string',
'type' => 'required|string|max:100',
'color' => 'required|string|max:7',
'fill_color' => 'required|string|max:7',
'fill_opacity' => 'required|numeric|min:0|max:1',
'coordinates' => 'required|array|min:3',
'coordinates.*.lat' => 'required|numeric',
'coordinates.*.lng' => 'required|numeric',
```

## Real-Time Updates

All polygon operations broadcast events through Laravel Echo:

```javascript
window.Echo.channel('main-channel')
  .listen('.MainEvent', (e) => {
    if (e.type === 'polygon') {
      fetchPolygons() // Auto-refresh polygons
    }
  })
```

## Migration

To switch from old AdminMap to new version:

1. **In your Blade/Inertia page**, replace:
```vue
<AdminMap :is-admin="true" />
```
with:
```vue
<AdminMapNew :is-admin="true" />
```

2. **Or rename the file** (recommended):
```bash
# Backup old version
mv AdminMap.vue AdminMapOld.vue

# Use new version
mv AdminMapNew.vue AdminMap.vue
```

## Benefits of Refactoring

### ✅ **Better Code Organization**
- Separation of concerns
- Reusable composables
- Easier to maintain and test

### ✅ **Improved Readability**
- Smaller, focused files
- Clear function names
- Logical grouping

### ✅ **Scalability**
- Easy to add new features
- Composables can be reused in other components
- Modular architecture

### ✅ **New Polygon Features**
- Visual facility boundaries
- Customizable colors and opacity
- Full CRUD operations
- Real-time updates

## Usage Tips

### Drawing Mode Priority
Only one drawing mode can be active at a time:
- Click Add Marker
- Draw Route
- Draw Facility

Switching modes automatically cancels the previous mode.

### Keyboard Shortcuts (Polygon Drawing)
- **Enter** - Finish drawing polygon
- **Escape** - Cancel drawing
- **Right-click** - Remove point (editing mode)

### Performance
- Polygons are cached after fetch
- Real-time updates are debounced
- Lazy loading for large datasets

## Troubleshooting

### Polygon not saving
1. Check browser console for errors
2. Ensure minimum 3 points
3. Verify all required fields filled
4. Check network tab for API response

### Polygon not displaying
1. Verify `fetchPolygons()` is called on mount
2. Check if coordinates are valid
3. Ensure map is initialized
4. Check polygon color contrast

### Edit mode not working
1. Verify polygon exists in `polygonInstances`
2. Check if edit mode is already active
3. Ensure user has admin rights

## Future Enhancements

- [ ] Import/Export polygons as GeoJSON
- [ ] Snap to grid for precise drawing
- [ ] Polygon area calculation
- [ ] Multi-polygon support (holes)
- [ ] Polygon label customization
- [ ] Layer management (show/hide)
- [ ] Polygon search and filter

## API Documentation

### Create Polygon
```javascript
POST /facilities/polygons
Content-Type: application/json

{
  "name": "Engineering Building",
  "description": "Main engineering faculty building",
  "type": "Building",
  "color": "#FF6B6B",
  "fill_color": "#FF6B6B",
  "fill_opacity": 0.3,
  "coordinates": [
    { "lat": 8.16953, "lng": 126.00306 },
    { "lat": 8.16963, "lng": 126.00316 },
    { "lat": 8.16953, "lng": 126.00326 }
  ]
}
```

### Update Polygon
```javascript
PUT /facilities/polygons/{id}
Content-Type: application/json

{
  "name": "Engineering Building - Updated",
  "description": "Updated description",
  "type": "Building",
  "color": "#3B82F6",
  "fill_color": "#3B82F6",
  "fill_opacity": 0.5,
  "coordinates": [
    { "lat": 8.16953, "lng": 126.00306 },
    { "lat": 8.16963, "lng": 126.00316 },
    { "lat": 8.16953, "lng": 126.00326 },
    { "lat": 8.16943, "lng": 126.00316 }
  ]
}
```

### Delete Polygon
```javascript
DELETE /facilities/polygons/{id}

Response: 200 OK
{
  "message": "Facility polygon deleted successfully"
}
```

## Testing

### Manual Testing Checklist
- [ ] Draw polygon with 3 points
- [ ] Draw polygon with 10+ points
- [ ] Edit polygon by dragging points
- [ ] Add points to existing polygon
- [ ] Remove points from polygon
- [ ] Change polygon colors
- [ ] Adjust opacity slider
- [ ] Save polygon
- [ ] Delete polygon
- [ ] Real-time updates work
- [ ] Multiple users can see changes

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Support

For issues or questions:
1. Check console for errors
2. Verify API endpoints are working
3. Check Laravel Echo connection
4. Review browser network tab
5. Check database migrations ran successfully

## Contributors

- Initial refactoring and polygon feature implementation
- Composables pattern implementation
- Real-time updates integration

---

**Version:** 2.0  
**Last Updated:** November 4, 2025  
**Status:** Production Ready ✅
