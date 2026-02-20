<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FacilityPolygon extends Model
{
    protected $fillable = [
        'name',
        'description',
        'type',
        'color',
        'fill_color',
        'fill_opacity',
        'coordinates'
    ];

    protected $casts = [
        'coordinates' => 'array',
        'fill_opacity' => 'float'
    ];
}
