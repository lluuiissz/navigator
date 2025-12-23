<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportDatabase extends Command
{
    protected $signature = 'db:import';
    protected $description = 'Import database from SQL file';

    public function handle()
    {
        $this->info('Starting database import...');
        
        $sqlFile = database_path('navigator_export.sql');
        
        if (!file_exists($sqlFile)) {
            $this->error('SQL file not found at: ' . $sqlFile);
            return 1;
        }
        
        $this->info('Reading SQL file...');
        $sql = file_get_contents($sqlFile);
        
        $this->info('Executing SQL statements...');
        
        try {
            // Disable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            
            // Execute the SQL
            DB::unprepared($sql);
            
            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            
            $this->info('✅ Database imported successfully!');
            return 0;
            
        } catch (\Exception $e) {
            $this->error('Import failed: ' . $e->getMessage());
            return 1;
        }
    }
}
