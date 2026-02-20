<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('facility_polygons', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type')->default('Building');
            $table->string('color')->default('#FF6B6B');
            $table->string('fill_color')->default('#FF6B6B');
            $table->decimal('fill_opacity', 3, 2)->default(0.30);
            $table->json('coordinates'); // Store polygon points as JSON
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('facility_polygons');
    }
};
