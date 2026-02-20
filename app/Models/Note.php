<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    protected $fillable = [
        'guest_id',
        'marker_id',
        'content'
    ];

    public function guest(){
        return $this->belongsTo(Guest::class);
    }
    public function marker(){
        return $this->belongsTo(Marker::class);
    }
}
