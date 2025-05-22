import { useEffect, useState, useRef } from 'react';
import './shared.css';
import UnitSubCompetencyTable from './UnitSubCompetencyTable';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { saveAs } from 'file-saver';
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SubCompetency = () => {
  const [units, setUnits] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedCompetency, setSelectedCompetency] = useState(null);
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showCompetencyDropdown, setShowCompetencyDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [competencies, setCompetencies] = useState([]);
  const [topicMappings, setTopicMappings] = useState({});
  const topicMappingsRef = useRef({});
  const [tableData, setTableData] = useState(null);
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const competencyDropdownRef = useRef(null);

  const fetchCompetencies = async () => {
    try {
      console.log('Fetching competencies from API...');
      const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCompetency`, {});
      
      if (response.data.status === 'success' && Array.isArray(response.data.data)) {
        const competenciesData = response.data.data.map(item => ({
          name: item.section_name,
          section_id: item.quiz_section_id[0],
          section_data: item
        }));
        
        // Create topic mappings
        const mappings = {};
        response.data.data.forEach(section => {
          if (section.topic_detail) {
            Object.entries(section.topic_detail).forEach(([topicId, topic]) => {
              mappings[topicId] = [topic.topic_name, section.section_name];
              console.log(`Created mapping for topic ${topicId}:`, {
                name: topic.topic_name,
                competency: section.section_name
              });
            });
          }
        });
        
        console.log('Created topic mappings:', mappings);
        setTopicMappings(mappings);
        topicMappingsRef.current = mappings; // Store in ref
        
        console.log('Competencies loaded from API:', competenciesData);
        setCompetencies(competenciesData);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error in fetchCompetencies:', error);
      setError(`Error loading competencies: ${error.message}`);
    }
  };

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

  // Initialize dropdown options but don't fetch report data
  const initializeDropdowns = async () => {
    try {
      await Promise.all([
        fetchUnitList(),
        fetchCompetencies()
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error initializing dropdowns:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Initializing component...');
    // Only load dropdown data, not report data
    initializeDropdowns();
    
    // Clear any previously loaded report data on initial load
    setReportData(null);
    
    // Add a global click handler to close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      // Close Units dropdown if clicking outside of it
      if (unitsDropdownRef.current && !unitsDropdownRef.current.contains(event.target)) {
        setShowUnitsDropdown(false);
      }
      
      // Close Competencies dropdown if clicking outside of it
      if (competencyDropdownRef.current && !competencyDropdownRef.current.contains(event.target)) {
        setShowCompetencyDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUnitSelect = (unit) => {
    // Clear report data whenever units selection changes
    setReportData(null);
    
    if (unit === 'all') {
      const newUnits = selectedUnits.length === units.length ? [] : units;
      setSelectedUnits(newUnits);
      console.log('Updated units (all toggle):', newUnits);
    } else {
      const updated = selectedUnits.includes(unit)
        ? selectedUnits.filter((u) => u !== unit)
        : [...selectedUnits, unit];
      setSelectedUnits(updated);
      console.log('Updated units (single toggle):', updated);
    }
  };

  useEffect(() => {
    console.log('✅ Current selectedUnits:', selectedUnits);
  }, [selectedUnits]);

  const handleCompetencySelect = (comp) => {
    // Clear report data whenever competency selection changes
    setReportData(null);
    setSelectedCompetency(comp.name);
    setShowCompetencyDropdown(false);
  };

  const handleClear = () => {
    console.log('Clearing filters...');
    setSelectedUnits([]);
    setSelectedCompetency(null);
    setShowUnitsDropdown(false);
    setShowCompetencyDropdown(false);
    setError(null);
    // Clear report data when filters are cleared
    setReportData(null);
  };

  const handleApply = async () => {
    console.log('📤 Applying filters...', {
      selectedUnits,
      selectedCompetency,
    });

    if (selectedUnits.length === 0 || !selectedCompetency) {
      setError('Please select at least one unit and a competency');
      // Clear any previous data when apply button is clicked without proper selections
      setReportData(null);
      return;
    }

    setLoading(true);
    setError(null);
    // Clear previous data before loading new data
    setReportData(null);
    console.log('Fetching data with filters:', { selectedUnits, selectedCompetency });

    try {
      // Find the selected competency object
      const competencyObj = competencies.find(c => c.name === selectedCompetency);
      
      if (!competencyObj) {
        setError('Selected competency not found');
        setLoading(false);
        return;
      }

      const requestBody = {
        unit: selectedUnits,
        section_id: [competencyObj.section_id] // Send as an array to match API expectations
      };

      console.log('Sending request body:', requestBody);
      
      const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCometencyUserReport`, requestBody, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('API Response:', response.data);

      if (response.data.status === 'success') {
        setReportData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch report data');
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      setError('Error fetching report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTableDataUpdate = (data) => {
    console.log('Received table data update:', data);
    if (data && data.rows && data.rows.length > 0) {
      // Make sure we have the maxScores and other relevant info for Excel export
      if (!data.topicMaxScores && data.topics) {
        // Create object to store topic max scores
        const topicMaxScores = {};
        
        // Get topic max scores from each topic
        data.topics.forEach(({ topicId }) => {
          // This should come from the table's calculation
          if (data.topicScores && data.topicScores[topicId]) {
            topicMaxScores[topicId] = data.topicScores[topicId];
          }
        });
        
        data.topicMaxScores = topicMaxScores;
      }
      
      // Store the total possible score as well
      if (!data.totalPossibleScore && data.totalPossibleScore !== 0) {
        data.totalPossibleScore = data.totalScore || "0.0";
      }
      
      setTableData(data);
    }
  };

  const exportToExcel = () => {
    console.log('Starting export process...');
    console.log('Current table data:', tableData);

    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      console.log('❌ No table data available');
      setError('No data available to download. Please apply filters first.');
      return;
    }

    try {
      console.log('Starting Excel export with table data');
      const flatData = [];

      // Process each row from the table data
      tableData.rows.forEach(row => {
        // Get the total possible score from the table data
        const totalPossibleScore = tableData.totalScore || tableData.totalPossibleScore || "0.0";
        
        const rowData = {
          'S.No': row.sno,
          'Student Name': row.studentName,
          'Unit': row.unit,
          'Department': row.department,
          // Include the "out of" score in the total score column header, just like in the table
          [`Total Score (Out of ${totalPossibleScore})`]: row.totalScore
        };

        // Add topic-specific columns with OUT OF scores
        tableData.topics.forEach(({ topicId, name }) => {
          const topicData = row.topicMap[topicId];
          if (topicData) {
            const abbr = tableData.abbreviations[topicId] || getAbbreviation(name);
            // Get the max score for this topic
            const maxScore = tableData.topicScores ? tableData.topicScores[topicId] || '10' : '10';
            // Use the exact same format as in the table header
            rowData[`${abbr} - Score (Out of ${maxScore})`] = topicData.score || '0';
            rowData[`${abbr} - Unit %ile`] = topicData.unitPercentile || '0';
            rowData[`${abbr} - MH %ile`] = topicData.mhPercentile || '0';
          }
        });

        console.log('Adding row data:', rowData);
        flatData.push(rowData);
      });

      console.log('Final processed data for Excel:', flatData);

      try {
        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(flatData);
        console.log('Worksheet created successfully');

        // Add legend data below the main data with OUT OF scores
        const legendData = tableData.topics.map(({ topicId, name }) => {
          const maxScore = tableData.topicScores ? tableData.topicScores[topicId] || '10' : '10';
          return {
            'Abbreviation': tableData.abbreviations[topicId] || getAbbreviation(name),
            'Full Topic Name': `${name} (Out of ${maxScore})`
          };
        });

        // Add a blank row
        XLSX.utils.sheet_add_aoa(worksheet, [['']], { origin: 'A' + (flatData.length + 2) });
        
        // Add legend header
        XLSX.utils.sheet_add_aoa(worksheet, [['Legend:']], { origin: 'A' + (flatData.length + 3) });
        
        // Add legend data
        legendData.forEach((item, index) => {
          // Remove 'Out of Score' from legend text but keep the abbreviation and topic name
          const legendText = `${item.Abbreviation} - ${item['Full Topic Name'].split(' (Out of ')[0]}`;
          XLSX.utils.sheet_add_aoa(worksheet, [[legendText]], 
            { origin: 'A' + (flatData.length + 4 + index) });
        });

        // Set column widths and alignment
        const columnWidths = [
          { wch: 10 },  // S.No
          { wch: 25 },  // Student Name
          { wch: 20 },  // Unit
          { wch: 20 },  // Department
          { wch: 30 },  // Total Score - wider for Out of text
        ];

        // Add dynamic column widths for topic-specific columns
        const topicColumns = Object.keys(flatData[0]).filter(key => 
          key.includes('Score') || key.includes('%ile')
        );
        topicColumns.forEach((key) => {
          // Use wider columns for Score columns that have Out of values
          if (key.includes('Score')) {
            columnWidths.push({ wch: 30 }); // Wider to accommodate Out of text
          } else {
            columnWidths.push({ wch: 20 }); // Regular width for percentile columns
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
        XLSX.utils.book_append_sheet(workbook, worksheet, 'UserWiseSubCompetency');
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
        const fileName = `UserWiseSubCompetency_Report_${selectedCompetency}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      } catch (excelError) {
        console.error('Error in Excel generation:', excelError);
        throw new Error('Failed to generate Excel file');
      }
    } catch (error) {
      console.error('❌ Error in export process:', error);
      setError(`Error generating Excel file: ${error.message}`);
    }
  };

  // Helper function to generate abbreviation from topic name
  const getAbbreviation = (topicName) => {
    const words = topicName.split(/[ \/]+/);
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  };

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div  className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-row">
        <div className="dropdown-container" ref={unitsDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}
          >
            <span>
              {selectedUnits.length > 0
                ? `${selectedUnits.length} unit(s) selected`
                : 'Select Units'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu">
              <label key="select-all" className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={() => handleUnitSelect('all')}
                />
                Select All
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

        <div className="dropdown-container" ref={competencyDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowCompetencyDropdown(!showCompetencyDropdown)}
          >
            <span>
              {selectedCompetency || 'Select Competency'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showCompetencyDropdown && (
            <div className="dropdown-menu">
              {competencies.map((comp) => (
                <label key={`${comp.section_id}-${comp.name}`} className="dropdown-item">
                  <input
                    type="radio"
                    name="competency"
                    checked={selectedCompetency === comp.name}
                    onChange={() => handleCompetencySelect(comp)}
                  />
                  {comp.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <button 
          className="apply-btn" 
          onClick={handleApply} 
          disabled={loading || competencies.length === 0}
        >
          {loading ? (
            <div className="spinner"></div>
          ) : (
            <>
              <span className="icon"></span> Apply
            </>
          )}
        </button>

        <button className="clear-btn" onClick={handleClear}>
          <span className="icon"></span> Clear
        </button>


        <button className="excel-btn" onClick={exportToExcel}>
          <span className="icon"></span> Excel
        </button>
      </div>

      <div className="report-content">
        <h2>Sub Competency Unit Wise Report</h2>
        <p className="subtitle">Detailed analysis of sub competency units</p>

        <div className="report-data">
          {loading ? (
            <div className="loading-message">
              <div className="spinner"></div>
              Loading report data...
            </div>
          ) : reportData ? (
            <UnitSubCompetencyTable 
              data={reportData} 
              selectedCompetency={selectedCompetency}
              searchTerm={searchTerm}
              onDataUpdate={handleTableDataUpdate}
            />
          ) : (
            <div className="no-filters-message">
              {error ? error : 'Please select filters and click "Apply" to view data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubCompetency;
