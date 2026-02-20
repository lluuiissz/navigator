<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    protected $fillable = [
        'guest_id',
        'marker_id',
        'message'
    ];

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function marker()
    {
        return $this->belongsTo(Marker::class);
    }
}
