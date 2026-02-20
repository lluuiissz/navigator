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
        Schema::create('allowed_ids', function (Blueprint $table) {
            $table->id();
            $table->string('id_number', 50)->unique();
            $table->string('full_name', 255);
            $table->string('course', 100)->nullable();
            $table->boolean('is_used')->default(false);
            $table->unsignedBigInteger('used_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('used_by_user_id')->references('id')->on('users')->onDelete('set null');
            $table->index('id_number');
            $table->index('is_used');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('allowed_ids');
    }
};
