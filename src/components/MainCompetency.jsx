import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ClipLoader } from 'react-spinners';
import './shared.css';
import CompetencyMainTable from './CompetencyMainTable';
// import CompetencyTable from './CompetencyTable';

const MainCompetency = () => {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedTest, setSelectedTest] = useState(''); // Changed for single select
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showTestsDropdown, setShowTestsDropdown] = useState(false);
  const [units, setUnits] = useState([]);
  const [quizList, setQuizList] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState(null);
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const testsDropdownRef = useRef(null);

  useEffect(() => {
    fetchUnitList();
    fetchQuizList();
    
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
      const res = await axios.post(`${BASE_URL}/reportanalytics/getQuizList`, {});
      if (Array.isArray(res.data)) {
        setQuizList(res.data);
      }
    } catch (err) {
      console.error('Error fetching quiz list:', err);
    }
  };

  const handleUnitSelect = (unit) => {
    setSelectedUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
  };

  const handleTestSelect = (testName) => {
    // If test selection is changing, clear the report data
    if (testName !== selectedTest) {
      setReportData(null);
      setTableData(null);
    }
    setSelectedTest(testName);
    setShowTestsDropdown(false); // Close dropdown on selection
  };

  const handleClear = () => {
    setSelectedUnits([]);
    setSelectedTest(''); // Reset to empty string for single select
    setReportData(null);
  };

  const handleApply = async () => {
    if (selectedUnits.length === 0 || !selectedTest) { // Changed for single select test
      alert('Please select unit(s) and a test.'); // Updated alert message
      return;
    }

    const quiz = quizList.find((q) => q.quiz_name === selectedTest);
    const selectedQuizId = quiz ? quiz.quiz_id : null;

    if (!selectedQuizId) {
        alert('Invalid test selection. Please select a valid test.');
        return;
    }

    const requestBody = {
      unit: selectedUnits,
      quiz_id: [selectedQuizId], // API might expect an array
    };

    try {
      setLoading(true);
      const response = await axios.post(
        `${BASE_URL}/reportanalytics/getMainCompetencyUnitReport`,
        requestBody
      );

      if (response.data) {
        setReportData(response.data);
      } else {
        console.error('Invalid response data format:', response.data);
        alert('Received invalid data format from server.');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      alert('Error fetching report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTableDataUpdate = useCallback((data) => {
    console.log('Received table data update:', data);
    if (data && data.rows && data.rows.length > 0) {
      // Make sure sections include maxScore values from the component
      if (data.sections) {
        // Get competency values from the CompetencyMainTable component
        const updatedSections = data.sections.map(section => {
          // This ensures we have the maxScore values as displayed in the table
          return {
            ...section,
            // Make sure maxScore exists
            maxScore: section.maxScore || section.id // Use the ID which will be matched in CompetencyMainTable
          };
        });
        data.sections = updatedSections;
      }
      setTableData(data);
    }
  }, []); // Remove tableData from dependencies to prevent update loop

  const handleDownloadExcel = () => {
    console.log('Current tableData state:', tableData);
    
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      console.log('No data available for download. TableData:', tableData);
      alert('No data available to download. Please wait for the table to load completely.');
      return;
    }

    try {
      console.log('Processing table data for Excel:', tableData);

      // Use EXACTLY the same total possible score as in the table
      // The CompetencyMainTable component now sends us the exact totalPossibleScore it displays
      // This ensures we use exactly the same value
      let totalPossibleScore;
      
      if (tableData.totalPossibleScore) {
        // Use the exact value from the table
        totalPossibleScore = parseFloat(tableData.totalPossibleScore);
        console.log('Using exact total possible score from table:', totalPossibleScore);
      } else {
        // Fallback calculation if totalPossibleScore is not provided
        totalPossibleScore = 0;
        
        // Look at each section and check if it has a proper maxScore value
        tableData.sections.forEach(section => {
          // Some sections might be missing maxScore, so we need a fallback
          if (section.maxScore) {
            // Make sure to use the same parsing logic as the table
            totalPossibleScore += parseFloat(section.maxScore || 0);
          } else {
            // If missing, use default 10 as in the table
            totalPossibleScore += 10;
          }
        });
      }
      
      console.log('Total possible score for Excel:', totalPossibleScore.toFixed(1));

      // Process the data for Excel using the table's data - ENSURE THIS MATCHES THE TABLE DISPLAY EXACTLY
      const flatData = tableData.rows.map((row, index) => {
        // Calculate total score for this row using EXACT SAME method as in the table display
        const totalScore = Object.entries(row.competencies).reduce((total, [_, data]) => {
          // Match the table display's calculation exactly
          const score = data.avg === '-' ? 0 : parseFloat(data.avg) || 0;
          return total + score;
        }, 0);
        
        const rowData = {
          'S.No': index + 1,
          'Unit': row.unitName,
          [`Total Score (Out of ${totalPossibleScore.toFixed(1)})`]: totalScore.toFixed(2) // Same precision as table
        };

        // Add competency scores and percentiles
        Object.entries(row.competencies).forEach(([competencyName, data]) => {
          const section = tableData.sections.find(s => s.name === competencyName);
          if (section) {
            // Get exactly the same maxScore value as is shown in the table
            // For this to match exactly, we need to get the maxScore directly from the HTML table
            // We'll make sure the value matches what's in the table header
            let maxScore;
            if (section.maxScore) {
              maxScore = section.maxScore;
            } else {
              // Default to 10 if not specified - MUST match the table default
              maxScore = '10';
            }
            
            // Ensure we're using the exact same value format as displayed in the table
            // Don't convert to numbers and back to strings as that can cause precision issues
            rowData[`${section.abbreviation} - Score (Out of ${maxScore})`] = data.avg; 
            rowData[`${section.abbreviation} - MH %ile`] = data.percentile;
          }
        });

        return rowData;
      });

      console.log('Processed Excel data:', flatData);

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(flatData);

      // Add legend data below the main data
      const legendData = tableData.sections.map(section => {
        const maxScore = section.maxScore || '10'; // Default to 10 if not specified
        return {
          'Abbreviation': section.abbreviation,
          'Full Competency Name': `${section.name} (Out of ${maxScore})`
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
        XLSX.utils.sheet_add_aoa(worksheet, [[legendText]], 
          { origin: 'A' + (flatData.length + 4 + index) });
      });

      // Set column widths - increased for better readability
      const columnWidths = [
        { wch: 10 },  // S.No
        { wch: 25 },  // Unit - increased width
        { wch: 30 },  // Total Score with Out of - increased width
      ];

      // Add dynamic column widths for section-specific columns
      const sectionColumns = Object.keys(flatData[0]).filter(key => 
        key.includes('Score') || key.includes('%ile')
      );
      sectionColumns.forEach((key) => {
        // Use wider columns for Score columns that have Out of values
        if (key.includes('Score')) {
          columnWidths.push({ wch: 30 }); // Wider for 'Out of' scores
        } else {
          columnWidths.push({ wch: 20 }); // Percentile columns
        }
      });

      worksheet['!cols'] = columnWidths;

      // Set cell alignment for all cells
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (!worksheet[cell_ref]) continue;
          
          // Set alignment for all cells
          worksheet[cell_ref].s = {
            alignment: {
              horizontal: 'left',
              vertical: 'center'
            }
          };
        }
      }

      // Create workbook and append worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'UnitWiseMainCompetencyReport');
      console.log('Workbook created successfully');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      console.log('Excel buffer generated successfully');

      // Create blob
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      console.log('Blob created successfully');

      // Save file
      const fileName = `UnitWiseMainCompetencyReport_${selectedTest}_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log('Attempting to save file:', fileName);
      
      // Try using saveAs directly
      try {
        saveAs(blob, fileName);
        console.log('File saved successfully using saveAs');
      } catch (saveError) {
        console.error('Error using saveAs:', saveError);
        
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
          console.log('File saved successfully using URL.createObjectURL');
        } catch (urlError) {
          console.error('Error using URL.createObjectURL:', urlError);
          throw new Error('Failed to save file using both methods');
        }
      }
    } catch (err) {
      console.error('Error downloading Excel:', err);
      alert('Error downloading Excel file. Please try again.');
    }
  };

  // Helper function to generate abbreviation from section name
  const getAbbreviation = (sectionName) => {
    const words = sectionName.split(/[ \/]+/);
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

      <div className="filters-row">
        {/* Units Dropdown */}
        <div className="dropdown-container" ref={unitsDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}
          >
            <span>
              {selectedUnits.length
                ? `${selectedUnits.length} Units Selected`
                : 'Select Units'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={() =>
                    setSelectedUnits(
                      selectedUnits.length === units.length ? [] : [...units]
                    )
                  }
                />
                Select All Units
              </label>
              {units.map((unit) => (
                <label key={unit} className="dropdown-item">
                  <input
                    type="checkbox"
                    checked={selectedUnits.includes(unit)}
                    onChange={() => handleUnitSelect(unit)}
                  />
                  {unit}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Tests Dropdown */}
        <div className="dropdown-container" ref={testsDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowTestsDropdown(!showTestsDropdown)}
          >
            <span>
              {selectedTest ? selectedTest : 'Select Test'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showTestsDropdown && (
            <div className="dropdown-menu">
              {quizList.map((quiz) => (
                <label key={quiz.quiz_id} className="dropdown-item">
                  <input
                    type="radio"
                    name="test"
                    checked={selectedTest === quiz.quiz_name}
                    onChange={() => handleTestSelect(quiz.quiz_name)}
                  />
                  {quiz.quiz_name}
                </label>
              ))}
              {quizList.length === 0 && (
                <div className="dropdown-item disabled">No tests available</div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="button-group">
          
          <button className="apply-btn" style={{width: '120px'}} onClick={handleApply}>
            Apply
          </button>
          <button className="clear-btn" style={{width: '120px'}} onClick={handleClear}>
            Clear
          </button>
          <button className="excel-btn" style={{width: '120px'}} onClick={handleDownloadExcel}>
            Excel
          </button>
        </div>
      </div>

      <div className="report-content">
        <h2>Main Competency Unit Wise Report</h2>
        <p className="subtitle">Detailed analysis of main competency units</p>

        {loading ? (
          <div className="spinner-container">
            <ClipLoader color="blue" loading={loading} size={50} />
          </div>
        ) : reportData ? (
          <div className="results-content">
            <CompetencyMainTable 
              units={selectedUnits} 
              quizId={selectedTest ? quizList.find(q => q.quiz_name === selectedTest)?.quiz_id : null}
              reportData={reportData}
              onDataUpdate={handleTableDataUpdate}
            />
          </div>
        ) : (
          <div className="no-filters-message">
            Please select filters and click "Apply" to view data.
          </div>
        )}
      </div>
    </div>
  );
};

export default MainCompetency;
