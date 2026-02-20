<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class FacilityPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'facility_id',
        'guest_id',
        'path',
        'caption',
    ];

    protected $appends = ['url'];

    protected $hidden = ['path'];

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function getUrlAttribute(): ?string
    {
        if (!$this->path) {
            return null;
        }

        return Storage::url($this->path);
        // return asset('storage/app/public/facility-photos' . $this->path);
    }
}
