import { useState, useEffect, useRef } from 'react';
import './shared.css';
import axios from 'axios';
import CompetencyTable from './CompetencyTable';
import * as XLSX from 'xlsx';
import { ClipLoader } from 'react-spinners'; // Import spinner component (if using `react-spinners`)
import { saveAs } from 'file-saver';
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const UserWise = () => {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedTest, setSelectedTest] = useState(''); // Quiz name for display
  const [selectedQuizId, setSelectedQuizId] = useState(''); // Actual quiz ID for API call
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showTestsDropdown, setShowTestsDropdown] = useState(false);
  const [units, setUnits] = useState([]);
  const [quizList, setQuizList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasStudentNames, setHasStudentNames] = useState(false);
  const [tableData, setTableData] = useState(null);
  
  // Refs for dropdown components and mounted state
  const unitsDropdownRef = useRef(null);
  const testsDropdownRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    const fetchUnitsAndQuizzes = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchUnitList();
        await fetchQuizList();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUnitsAndQuizzes();
    
    // Add a global click handler to close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      // Close Units dropdown if clicking outside of it
      if (unitsDropdownRef.current && !unitsDropdownRef.current.contains(event.target)) {
        setShowUnitsDropdown(false);
      }
      
      // Close Tests dropdown if clicking outside of it
      if (testsDropdownRef.current && !testsDropdownRef.current.contains(event.target)) {
        setShowTestsDropdown(false);
      }
    };
    
    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (reportData && reportData.data) {
      const hasNames = Object.values(reportData.data).some(item => item.student_name || item.name);
      setHasStudentNames(hasNames);
    }
  }, [reportData]);

  const fetchUnitList = async () => {
    try {
      const response = await axios.post(`${BASE_URL}/reportanalytics/getUnitList`, {}, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data.status === 'success') {
        // Combine all units from all regions dynamically and sort them
        const allUnits = Object.values(response.data.units).flat().sort();
        setUnits(allUnits);
      } else {
        setError('Failed to fetch units. Status not "success".');
      }
    } catch (error) {
      setError('Error loading units. Please try again.');
    }
  };

  const fetchQuizList = async () => {
    try {
      const response = await axios.post(`${BASE_URL}/reportanalytics/getQuizList`, {}, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data && Array.isArray(response.data)) {
        setQuizList(response.data);
      } else {
        setError('Failed to fetch quizzes: Data not in expected format.');
      }
    } catch (error) {
      setError('Could not fetch quiz list. Please try again later.');
    }
  };

  const handleApplyFilters = async () => {
    if (selectedUnits.length === 0 || !selectedQuizId) {
      setError('Please select unit(s) and a test before applying filters.');
      setReportData(null); // Clear data if selections are invalid
      return;
    }

    const requestBody = {
      unit: selectedUnits,
      quiz_id: [selectedQuizId] // API expects an array
    };

    setError(null); // Clear previous errors before new request
    setReportData(null); // Clear previous data before new request
    setLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/reportanalytics/getMainCompetencyUserReport`, requestBody, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data?.status === "success") {
        setReportData(response.data);
      } else {
        setError(response.data?.message || 'Failed to fetch report: API did not return success status.');
        setReportData(null); // Ensure data is cleared on non-success
      }
    } catch (error) {
      setError('Failed to fetch report. Please check your connection and try again.');
      setReportData(null); // Ensure data is cleared on catch
    } finally {
      setLoading(false);
    }
  };

  const handleUnitSelect = (unit) => {
    if (selectedUnits.includes(unit)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unit));
    } else {
      setSelectedUnits([...selectedUnits, unit]);
    }
  };

  const handleTestSelect = (quiz) => {
    setSelectedTest(quiz.quiz_name);
    setSelectedQuizId(quiz.quiz_id);
    setShowTestsDropdown(false);

  };

  const toggleSelectAllUnits = () => {
    if (selectedUnits.length === units.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(units);
    }
  };

  const handleClear = () => {
    setSelectedUnits([]);
    setSelectedTest('');
    setSelectedQuizId('');
    setReportData(null);
  };

  const handleTableDataUpdate = (data) => {
    setTableData(data);
  };

  const handleExport = () => {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      setError('No data available to download. Please apply filters first.');
      return;
    }

    try {
      const flatData = [];
      
      // Get section max scores from the CompetencyTable component
      // These should be displayed in the table headers
      const sectionMaxScores = {};
      
      // Get the actual max scores from the tableData
      // These scores are calculated in the CompetencyTable component
      tableData.headerScores = tableData.headerScores || {};
      
      // Use the exact scores from the table data
      tableData.sections.forEach(section => {
        const sectionId = section.id;
        // Use the headerScores from the table data which matches what's shown in the table
        sectionMaxScores[sectionId] = tableData.headerScores[sectionId] || '10';
      });
      
      // Calculate total possible score - sum of all section max scores
      const totalPossibleScore = Object.values(sectionMaxScores)
        .reduce((sum, score) => sum + parseFloat(score || 0), 0)
        .toFixed(2);
      
      // Process each row from the table data
      tableData.rows.forEach((row, index) => {
        const rowData = {
          'S.No': index + 1,
          'Student Name': row.studentName || '-',
          'Units': Array.isArray(row.units) ? row.units.join(', ') : Array.from(row.units || []).join(', '),
          'Department': row.department || '-',
          [`Total Score (Out of ${totalPossibleScore})`]: (row.totalScore || 0).toFixed(2)
        };

        // Add competency-specific columns with scores in headers
        tableData.sections.forEach(({ id, abbreviation, name }) => {
          const sectionData = row.sectionDetail?.[id];
          // Use the exact max score from the table data's headerScores
          const maxScore = tableData.headerScores[id] || sectionMaxScores[id] || '10';
          
          // Use the same score format as shown in the table
          const displayScore = sectionData?.calculated_score || '0';
          
          // Don't format the score - keep it exactly as it is in the table
          rowData[`${abbreviation} - Score (Out of ${maxScore})`] = displayScore;
          rowData[`${abbreviation} - MH %ile`] = sectionData?.section_percentile_score || '0';
          rowData[`${abbreviation} - Unit %ile`] = sectionData?.unit_section_percentile_score || '0';
        });

        console.log('Adding row data:', rowData);
        flatData.push(rowData);
      });

      console.log('Final processed data for Excel:', flatData);

      try {
        // Create worksheet for main data
        const worksheet = XLSX.utils.json_to_sheet(flatData);
        console.log('Worksheet created successfully');

        // Add legend data below the main data
        const legendData = tableData.sections.map(({ id, abbreviation, name }) => {
          // Use the exact max score from tableData.headerScores
          const maxScore = tableData.headerScores[id] || sectionMaxScores[id] || '10';
          return {
            'Abbreviation': abbreviation,
            'Full Competency Name': `${name} (Out of ${maxScore})`
          };
        });

        // Add a blank row
        XLSX.utils.sheet_add_aoa(worksheet, [['']], { origin: 'A' + (flatData.length + 2) });
        
        // Add legend header
        XLSX.utils.sheet_add_aoa(worksheet, [['Legend:']], { origin: 'A' + (flatData.length + 3) });
        
        // Add legend data
        legendData.forEach((item, index) => {
          // Remove 'Out of Score' from legend text but keep the abbreviation and competency name
          const legendText = `${item.Abbreviation} - ${item['Full Competency Name'].split(' (Out of ')[0]}`;
          XLSX.utils.sheet_add_aoa(
            worksheet, 
            [[legendText]], 
            { origin: 'A' + (flatData.length + 4 + index) }
          );
        });
        
        // Set column widths - increased for better readability
        const columnWidths = [
          { wch: 10 },  // S.No
          { wch: 30 },  // Student Name
          { wch: 30 },  // Units
          { wch: 20 },  // Department
          { wch: 35 },  // Total Score with Out of - increased width
        ];
        
        // Add dynamic column widths for competency-specific columns
        const competencyColumns = Object.keys(flatData[0]).filter(key => 
          key.includes('Score') || key.includes('%ile')
        );
        competencyColumns.forEach((key) => {
          // Use wider columns for Score columns that have Out of values
          if (key.includes('Score')) {
            columnWidths.push({ wch: 35 }); // Wider for 'Out of' scores
          } else {
            columnWidths.push({ wch: 20 }); // Percentile columns
          }
        });
        
        worksheet['!cols'] = columnWidths;

        // Column widths are already set above

        // Create workbook and append worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'UserWise Main Competency Report');
        console.log('Workbook created successfully');

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        console.log('Excel buffer generated successfully');

        // Create blob
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Save file
        const fileName = `UserWise_Main_Competency_Report_${selectedTest}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Try using saveAs directly
        try {
          saveAs(blob, fileName);
        } catch (saveError) {
          // Fallback method using URL.createObjectURL
          try {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } catch (urlError) {
            throw new Error('Failed to save file');
          }
        }
      } catch (excelError) {
        throw new Error('Failed to generate Excel file');
      }
    } catch (error) {
      setError(`Error generating Excel file: ${error.message}`);
    }
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  const calculateTotalScore = (sectionId) => {
    if (!reportData?.data) return 0;

    // If no sectionId is provided, calculate total possible score for all sections
    if (!sectionId) {
      let totalScore = 0;
      for (const unitId in reportData.data) {
        const unit = reportData.data[unitId];
        if (!unit.quiz_detail) continue;

        for (const quizId in unit.quiz_detail) {
          const quiz = unit.quiz_detail[quizId];
          if (!quiz) continue;

          for (const studentId in quiz) {
            const studentData = quiz[studentId];
            if (!studentData?.quiz_detail?.[quizId]?.section_detail) continue;

            const sectionDetail = studentData.quiz_detail[quizId].section_detail;
            for (const sid in sectionDetail) {
              const section = sectionDetail[sid];
              // Just use correct_marks as the total score
              if (section.correct_marks) {
                const correctMarks = parseFloat(section.correct_marks);
                if (!isNaN(correctMarks)) {
                  totalScore += correctMarks;
                }
              }
            }
          }
        }
      }
      return totalScore.toFixed(1);
    }

    // Calculate score for specific section
    for (const unitId in reportData.data) {
      const unit = reportData.data[unitId];
      if (!unit.quiz_detail) continue;

      for (const quizId in unit.quiz_detail) {
        const quiz = unit.quiz_detail[quizId];
        if (!quiz) continue;

        for (const studentId in quiz) {
          const studentData = quiz[studentId];
          if (!studentData?.quiz_detail?.[quizId]?.section_detail?.[sectionId]) continue;

          const section = studentData.quiz_detail[quizId].section_detail[sectionId];
          // Just use correct_marks as the total score
          if (section.correct_marks) {
            const correctMarks = parseFloat(section.correct_marks);
            if (!isNaN(correctMarks)) {
              return correctMarks.toFixed(1);
            }
          }
        }
      }
    }

    return 0;
  };

  return (
    <div className="userwise-container">
      <h1 style={{color:'blue', fontSize:'20px', fontWeight:'bold',marginBottom:'10px'}}>Performance Report</h1>

      <div className="filters-row">
        {/* Units Filter */}
        <div className="dropdown-container" ref={unitsDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}
          >
            <span>{selectedUnits.length ? `${selectedUnits.length} Units Selected` : 'Select Units'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu no-scroll">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={toggleSelectAllUnits}
                />
                Select All Units
              </label>
              {loading ? (
                <div className="loading-message">
                  <ClipLoader size={20} color={"#3498db"} loading={loading} />
                  Loading units...
                </div>
              ) : error ? (
                <div className="error-message">{error}</div>
              ) : (
                units.map(unit => (
                  <label key={unit} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={selectedUnits.includes(unit)}
                      onChange={() => handleUnitSelect(unit)}
                    />
                    {unit}
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="dropdown-container" ref={testsDropdownRef}>
          <div className="dropdown-header" onClick={() => setShowTestsDropdown(!showTestsDropdown)}>
            <span>{selectedTest ? selectedTest : 'Select Test'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showTestsDropdown && (
            <div className="dropdown-menu">
              {/* Select All Tests option removed for single select */}
              {loading ? (
                <div className="loading-message">
                  <ClipLoader size={20} color={"#3498db"} loading={loading} />
                  Loading tests...
                </div>
              ) : quizList.length > 0 ? (
                quizList.map(quiz => (
                  <div 
                    key={quiz.quiz_id} 
                    className={`dropdown-item ${selectedTest === quiz.quiz_name ? 'selected' : ''}`}
                    onClick={() => handleTestSelect(quiz)}
                  >
                    <span className="select-circle"></span>
                    {quiz.quiz_name}
                  </div>
                ))
              ) : (
                <div className="dropdown-item disabled">No tests available</div>
              )}
            </div>
          )}
        </div>

        <button className="apply-btn" onClick={handleApplyFilters}>Apply </button>
        <button className="clear-btn" onClick={handleClear}>Clear</button>
      
        <button className="excel-btn" onClick={handleExport}>Excel</button>
      </div>

      <div className="report-content">
        <h2>User Wise Main Competency Report</h2>
        <p className="subtitle">Detailed analysis of main competencies by user</p>

        <div className="report-data">
          {loading ? (
            <div className="loading-container">
              <ClipLoader color="#4A90E2" loading={loading} size={50} />
              <p>Loading data...</p>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : reportData && reportData.data ? (
            <div className="table-wrapper">
              <CompetencyTable 
                data={reportData.data} 
                searchTerm={searchTerm}
                selectedQuizId={selectedQuizId}
                onDataUpdate={handleTableDataUpdate}
              />
            </div>
          ) : (
            <div className="no-data-message">
              {selectedUnits.length === 0 || !selectedQuizId 
                ? 'Please select unit(s) and a test to view data.'
                : 'No data available for the selected filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserWise;
