<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Facility extends Model
{
    protected $fillable = [
        'name',
        'category',
        'department',
        'description',
        'floor_number',
        'hours',
        'marker_id',
        'status',
    ];

    public function marker()
    {
        return $this->belongsTo(Marker::class);
    }

    public function photos()
    {
        return $this->hasMany(FacilityPhoto::class);
    }
}
