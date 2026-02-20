<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    use HasFactory;

    protected $fillable = [
        'start_lat',
        'start_lng',
        'end_lat',
        'end_lng',
        'estimated_time',
        'path_data',
        'color',
    ];

    protected $casts = [
        'path_data' => 'array',
    ];

    /**
     * Get the route as GeoJSON LineString.
     */
    public function toGeoJSON()
    {
        return [
            'type' => 'Feature',
            'properties' => [
                'id' => $this->id,
                'start_location' => $this->start_location,
                'end_location' => $this->end_location,
                'estimated_time' => $this->estimated_time,
            ],
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => array_map(function ($point) {
                    return [$point['lng'], $point['lat']];
                }, $this->path_data)
            ]
        ];
    }
}
