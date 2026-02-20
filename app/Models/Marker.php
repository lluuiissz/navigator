<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Marker extends Model
{
    protected $fillable = [
        'latitude',
        'longitude',
        'label',
        'type',
    ];
    public function facilities()
    {
        return $this->hasMany(Facility::class);
    }

    public function notes(){
        return $this->hasMany(Note::class);
    }

    public function feedbacks(){
        return $this->hasMany(Feedback::class);
    }
}
