# CSV Export Endpoint Test Documentation

## New Endpoint: GET /documents/csv/:jobId

### Description
Exports lab reports from a completed job as a CSV file with the specified format.

### CSV Format
The CSV includes 10 columns:
1. Parameter - Lab test parameter name
2. Result - Test result value
3. Unit - Measurement unit
4. Range - Reference range
5. comment - Any comments
6. Parameter Matched - Matched parameter from database
7. Result - (Empty column)
8. Unit - (Empty column)
9. Range - (Empty column)
10. comment - (Empty column)

### Example Usage

```bash
# Request
GET /documents/csv/test-job-123

# Response Headers
Content-Type: text/csv
Content-Disposition: attachment; filename="lab_report_test-job-123.csv"

# Response Body (CSV Content)
Parameter,Result,Unit,Range,comment,Parameter Matched,Result,Unit,Range,comment
RBC,4.5,10e6/µL,3.8 - 5.1,,RBC - blood,,,,
Hemoglobin,137,g/dL,11.7 - 15.5,,Hemoglobin - blood,,,,
Glucose,108,mg/dL,70 - 110,,Glucose - blood,,,,
```

### Implementation Details

#### Service Method: `generateLabReportsCsv(jobId: string)`
- Reuses existing `getResultStructure()` method
- Filters lab reports with valid test parameters
- Maintains sorting by index (ascending order)
- Handles CSV escaping for special characters
- Returns null if job not found/completed or no lab reports

#### Controller Endpoint: `exportLabReportsCsv()`
- Sets appropriate CSV headers for file download
- Handles error cases (404, 500)
- Returns CSV content directly as file download

### Error Handling
- **404**: Job not found, not completed, or no lab reports available
- **500**: Internal server error during CSV generation

### Features
- ✅ Proper CSV escaping for commas, quotes, newlines
- ✅ Consistent with existing `getResultStructure` filtering/sorting
- ✅ File download with proper headers
- ✅ Comprehensive error handling
- ✅ Swagger API documentation
- ✅ Matches sample.csv format exactly

### Testing
To test this endpoint:
1. Process a medical document with lab reports
2. Wait for job completion
3. Call `GET /documents/csv/{jobId}` to download CSV file
4. Verify CSV format matches specification
