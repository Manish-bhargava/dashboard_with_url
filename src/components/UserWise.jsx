import { useState, useEffect, useRef } from 'react';
import './shared.css';
import axios from 'axios';
import CompetencyTable from './CompetencyTable';
import * as XLSX from 'xlsx';
import { ClipLoader } from 'react-spinners'; // Import spinner component (if using `react-spinners`)
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
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const testsDropdownRef = useRef(null);

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
      console.error('❌ Error fetching unit list:', error);
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
      console.error('❌ Error fetching quiz list:', error);
      setError('Could not fetch quiz list. Please try again later.');
    }
  };

  const handleApplyFilters = async () => {
    if (selectedUnits.length === 0 || !selectedQuizId) {
      setError('Please select unit(s) and a test before applying filters.');
      setReportData(null); // Clear data if selections are invalid
      return;
    }

    console.log("✅ Selected Units:", selectedUnits);
    console.log("✅ Selected Quiz ID:", selectedQuizId);
    console.log("✅ Selected Test:", selectedTest); // Changed log key

    const requestBody = {
      unit: selectedUnits,
      quiz_id: [selectedQuizId] // API expects an array
    };
    
    console.log('🔍 Request Body:', requestBody);

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
      console.error('❌ Error fetching main competency report:', error);
      setError('Failed to fetch report due to a network or server error.');
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
    console.log(`Selected quiz: ${quiz.quiz_name} (ID: ${quiz.quiz_id})`);
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

  const handleExport = () => {
    if (!reportData || !reportData.data) {
      alert('No data available to export.');
      return;
    }

    // Create a function to generate abbreviation from section name
    const getAbbreviation = (sectionName) => {
      // Split section name by spaces or forward slashes
      const words = sectionName.split(/[ \/]+/);
      // Create abbreviation from first letter of each word
      return words.map(word => word.charAt(0).toUpperCase()).join('');
    };

    // Map to store competency abbreviations - will be used for the legend
    const competencyAbbreviations = {};

    const data = reportData.data;
    const mergedStudentDataMap = new Map(); // To merge data for same student ID

    Object.entries(data).forEach(([unitKey, unitData]) => {
      const quizDetails = unitData.quiz_detail || {};

      Object.entries(quizDetails).forEach(([quizId, studentsInQuiz]) => {
        Object.entries(studentsInQuiz).forEach(([studentId, studentData]) => {
          const userDetails = studentData.user_basic_detail || {};
          const studentName = userDetails.student_name || '-';
          const unitName = userDetails.unit_name || unitKey;
          const department = userDetails.department || '-';
          const totalScore = studentData.total_score?.[quizId] || '-';
          const leadershipInitialScore = studentData.leadership_initial_score || '-';

          const quizData = studentData.quiz_detail?.[quizId];
          const sectionDetail = quizData?.section_detail || {};

          // Create or update student record in mergedStudentDataMap
          if (!mergedStudentDataMap.has(studentId)) {
            mergedStudentDataMap.set(studentId, {
              'Student ID': studentId,
              'Student Name': studentName,
              'Department': department,
              'Leadership Initial Score': leadershipInitialScore,
              'Units': new Set([unitName]),
              'Scores': {}
            });
          } else {
            const existingRecord = mergedStudentDataMap.get(studentId);
            existingRecord.Units.add(unitName);
          }

          // Add competency scores with abbreviations
          const studentRecord = mergedStudentDataMap.get(studentId);
          Object.values(sectionDetail).forEach((section) => {
            const sectionName = section.section_name;
            // Generate abbreviation and store in the map
            const abbr = getAbbreviation(sectionName);
            competencyAbbreviations[abbr] = sectionName;
            
            // Use abbreviations instead of full section names
            studentRecord.Scores[`${abbr} - Score`] = section.section_total_score;
            studentRecord.Scores[`${abbr} - MH %ile`] = section.section_percentile_score;
            studentRecord.Scores[`${abbr} - Unit %ile`] = section.unit_section_percentile_score;
          });
        });
      });
    });

    // Convert Map to array and format for Excel
    const rows = Array.from(mergedStudentDataMap.values()).map(record => ({
      'Student ID': record['Student ID'],
      'Student Name': record['Student Name'],
      'Department': record['Department'],
      'Leadership Initial Score': record['Leadership Initial Score'],
      'Units': Array.from(record.Units).join(', '),
      ...record.Scores
    }));

    if (rows.length === 0) {
      alert('No processed data to export.');
      return;
    }

    // Create the worksheet for user data
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UserWise Report');

    // Create a legend/key worksheet
    const legendRows = Object.entries(competencyAbbreviations).map(([abbr, fullName]) => ({
      'Abbreviation': abbr,
      'Full Competency Name': fullName
    }));

    if (legendRows.length > 0) {
      const legendWorksheet = XLSX.utils.json_to_sheet(legendRows);
      XLSX.utils.book_append_sheet(workbook, legendWorksheet, 'Legend');
      
      // Add a note about the legend to the main worksheet
      const legendNote = 'Note: See the "Legend" sheet for full competency names';
      XLSX.utils.sheet_add_aoa(worksheet, [[legendNote]], { origin: 'A' + (rows.length + 2) });
    }

    // Write to file with both sheets
    XLSX.writeFile(workbook, 'UserWise_Main_Competency_Report.xlsx');
    
    console.log('✅ Export completed with abbreviated column names and legend');
    console.log('✅ Legend shows these abbreviations:', competencyAbbreviations);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

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
            <div className="loading-message" style={{ textAlign: 'center', padding: '20px' }}>
              <ClipLoader size={40} color={"#3498db"} loading={loading} />
              <p>Loading report...</p>
            </div>
          ) : error ? (
            <div className="error-message" style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
              {error}
            </div>
          ) : reportData && reportData.data && typeof reportData.data === 'object' && Object.keys(reportData.data).length > 0 ? (
            <div className={`results-content ${isZoomed ? 'zoomed' : ''}`}>
              <CompetencyTable data={reportData.data} searchTerm={searchTerm} />
            </div>
          ) : (
            <p className="no-data-message" style={{ textAlign: 'center', padding: '20px' }}>
              {/* Message depends on whether filters were actively applied or it's an initial/cleared state */}
              {(selectedUnits.length > 0 || selectedTest) && !error 
                ? 'No data found for the selected filters. Please adjust your selections or try again.'
                : 'Please select units and tests, then click "Apply Filters" to view the report.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserWise;
