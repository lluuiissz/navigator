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
            Schema::create('markers', function (Blueprint $table) {
                $table->id();
                $table->decimal('latitude', 10, 8);
                $table->decimal('longitude', 11, 8);
                $table->string('label');
                $table->string('type')->default('building');
                $table->timestamps();
            });
        }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('markers');
    }
};
