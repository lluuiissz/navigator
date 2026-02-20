<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AllowedId;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class AllowlistController extends Controller
{
    /** Display the allowlist management page */
    public function index(Request $request)
    {
        $query = AllowedId::query()->with('user');

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('id_number', 'like', "%{$search}%")
                  ->orWhere('full_name', 'like', "%{$search}%")
                  ->orWhere('course', 'like', "%{$search}%");
            });
        }

        if ($request->has('status')) {
            if ($request->status === 'used') {
                $query->used();
            } elseif ($request->status === 'unused') {
                $query->unused();
            }
        }

        // Filter by role (student | faculty)
        if ($request->has('role') && in_array($request->role, ['student', 'faculty'])) {
            $query->where('role', $request->role);
        }

        $allowedIds = $query->orderBy('created_at', 'desc')->paginate(20);

        $stats = [
            'total'    => AllowedId::count(),
            'used'     => AllowedId::used()->count(),
            'unused'   => AllowedId::unused()->count(),
            'students' => AllowedId::students()->count(),
            'faculty'  => AllowedId::faculty()->count(),
        ];

        return Inertia::render('admin/Allowlist', [
            'allowedIds' => $allowedIds,
            'stats'      => $stats,
            'filters'    => $request->only(['search', 'status', 'role']),
        ]);
    }

    /**
     * Upload and process CSV file.
     *
     * Supported CSV formats:
     *   student_id,full_name,course[,role]
     *   ID_Number,Full_name,course[,role]
     *
     * The optional `role` column can be "student" or "faculty".
     * If missing, the value defaults to "student".
     * Admins can also upload a pure faculty CSV by passing ?role=faculty
     * in the query string — that value overrides any per-row role column.
     */
    public function uploadCSV(Request $request)
    {
        Log::info('CSV Upload Request', [
            'has_file'  => $request->hasFile('csv_file'),
            'role_hint' => $request->input('role_hint'),
        ]);

        try {
            $request->validate([
                'csv_file'  => 'required|file|mimes:csv,txt|mimetypes:text/plain,text/csv,application/csv,application/vnd.ms-excel,text/x-csv|max:10240',
                'role_hint' => 'nullable|in:student,faculty',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error'   => 'Validation failed',
                'details' => $e->errors(),
            ], 422);
        }

        $file      = $request->file('csv_file');
        $path      = $file->getRealPath();
        $roleHint  = $request->input('role_hint'); // optional override

        DB::beginTransaction();
        try {
            $csvData = array_map('str_getcsv', file($path));
            $header  = array_map('trim', array_shift($csvData));

            // Detect which column index is the role column (optional)
            $roleColIndex = array_search('role', array_map('strtolower', $header));

            // Validate the required columns
            $idCol   = null;
            $nameCol = null;
            $courseCol = null;

            foreach ($header as $i => $col) {
                $col = strtolower($col);
                if (in_array($col, ['id_number', 'student_id'])) $idCol     = $i;
                if (in_array($col, ['full_name']))                  $nameCol   = $i;
                if ($col === 'course')                               $courseCol = $i;
            }

            if ($idCol === null || $nameCol === null) {
                return response()->json([
                    'error' => 'Invalid CSV format. Expected columns: student_id (or ID_Number), full_name, course, [role]',
                    'found' => implode(',', $header),
                ], 422);
            }

            $imported = 0;
            $skipped  = 0;
            $errors   = [];

            foreach ($csvData as $index => $row) {
                $lineNumber = $index + 2;

                if (empty($row) || count($row) < 2) continue;

                $idNumber = trim($row[$idCol]   ?? '');
                $fullName = trim($row[$nameCol] ?? '');
                $course   = $courseCol !== null ? trim($row[$courseCol] ?? '') : '';

                // Determine role: row column > admin hint > default 'student'
                $rowRole = 'student';
                if ($roleColIndex !== false && isset($row[$roleColIndex])) {
                    $r = strtolower(trim($row[$roleColIndex]));
                    if (in_array($r, ['student', 'faculty'])) $rowRole = $r;
                }
                if ($roleHint) {
                    $rowRole = $roleHint; // URL param overrides per-row value
                }

                if (empty($idNumber) || empty($fullName)) {
                    $errors[] = "Line {$lineNumber}: ID Number and Full Name are required";
                    $skipped++;
                    continue;
                }

                $existing = AllowedId::where('id_number', $idNumber)->first();
                if ($existing) {
                    $skipped++;
                    continue;
                }

                AllowedId::create([
                    'id_number' => $idNumber,
                    'full_name' => $fullName,
                    'course'    => $course ?: null,
                    'role'      => $rowRole,
                ]);

                $imported++;
            }

            DB::commit();

            return response()->json([
                'success'  => true,
                'imported' => $imported,
                'skipped'  => $skipped,
                'errors'   => $errors,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to process CSV: ' . $e->getMessage(),
            ], 500);
        }
    }

    /** Delete an allowed ID (only if not yet used) */
    public function destroy($id)
    {
        $allowedId = AllowedId::findOrFail($id);

        if ($allowedId->is_used) {
            return response()->json([
                'error' => 'Cannot delete ID that has been used for registration',
            ], 422);
        }

        $allowedId->delete();

        return response()->json([
            'success' => true,
            'message' => 'ID removed from allowlist',
        ]);
    }
}
