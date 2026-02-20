<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'description',
        'type',
        'generated_by',
        'data',
        'period_from',
        'period_to',
        'status'
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'data' => 'json',
        'period_from' => 'datetime',
        'period_to' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user who generated this report.
     */
    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    /**
     * Scope to get published reports.
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope to get reports by type.
     */
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope to get reports within a date range.
     */
    public function scopeWithinDateRange($query, $from, $to)
    {
        return $query->whereBetween('period_from', [$from, $to])
                     ->orWhereBetween('period_to', [$from, $to]);
    }
}
