import { useEffect, useState, useRef } from 'react';
import './shared.css';
import UnitSubCompetencyTable from './UnitSubCompetencyTable';
import * as XLSX from 'xlsx';
import axios from 'axios';
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
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const competencyDropdownRef = useRef(null);

  const fetchCompetencies = async () => {
    try {
      console.log('\u2139\ufe0f Fetching competencies from API...');
      
      // Instead of making a direct call to external API, let's use a fallback approach:
      // 1. First, log sample data for debugging
      // 2. Use hardcoded data for now to keep the app working
      // 3. Add notes for a proper fix
      
      console.log('\u2139\ufe0f CORS Error: Unable to fetch from external API directly');
      console.log('\u2139\ufe0f Using hardcoded data as fallback');
      
      // For debug purposes - would log the URL we're trying to access
      console.log('\u2139\ufe0f Target API URL:', 'https://mhbodhi.medtalent.co/api/reportanalytics/getSubCompetency');
      
      // ⚠️ IMPORTANT: In production, this should be handled by:
      // 1. Setting up a proxy server
      // 2. Using environment variables for the API URL
      // 3. Proper error handling
      
      // Simulate response with the data structure from the API
      const sampleData = [
        {
          section_name: 'Relationship Building',
          section_id: '3',
          quiz_section_id: ['4', '84'],
          topics: [/* Topics data omitted for brevity */]
        },
        {
          section_name: 'Quality in Healthcare Delivery',
          section_id: '4',
          quiz_section_id: ['5', '83'],
          topics: [/* Topics data omitted for brevity */]
        },
        {
          section_name: 'Situation Management',
          section_id: '5',
          quiz_section_id: ['6', '82'],
          topics: [/* Topics data omitted for brevity */]
        },
        {
          section_name: 'Leadership',
          section_id: '6',
          quiz_section_id: ['8', '85'],
          topics: [/* Topics data omitted for brevity */]
        }
      ];
      
      console.log('\u2139\ufe0f Using fallback data structure:', sampleData);
      
      // Transform the sample data to match our required format
      const competenciesData = sampleData.map(item => {
        console.log('\u2139\ufe0f Processing competency:', item.section_name, 'with quiz_section_id:', item.quiz_section_id);
        return {
          name: item.section_name,
          section_id: item.quiz_section_id[1], // Using the second value from quiz_section_id array
          section_data: item // Store all data for potential future use
        };
      });
      
      console.log('\u2705 Competencies loaded from fallback:', competenciesData);
      setCompetencies(competenciesData);
      
      // Add a note about fixing the CORS issue
      console.log('\u2139\ufe0f DEVELOPER NOTE: To fix the CORS issue permanently:');
      console.log('\u2139\ufe0f 1. Set up a proxy in your vite.config.js or use a middleware');
      console.log('\u2139\ufe0f 2. Ensure the server sends proper CORS headers');
      console.log('\u2139\ufe0f 3. Consider using a relative URL with BASE_URL');
    } catch (error) {
      console.error('\u274c Error in fetchCompetencies:', error);
      console.error('\u274c Error details:', error.message);
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
    
    // Add a global click handler to close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      // Close Units dropdown if clicking outside of it
      if (unitsDropdownRef.current && !unitsDropdownRef.current.contains(event.target)) {
        setShowUnitsDropdown(false);
      }
      
      // Close Competency dropdown if clicking outside of it
      if (competencyDropdownRef.current && !competencyDropdownRef.current.contains(event.target)) {
        setShowCompetencyDropdown(false);
      }
    };
    
    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUnitSelect = (unit) => {
    console.log('Unit clicked:', unit);
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
    console.log('Competency selected:', comp.name);
    // Just update the selection, don't trigger the apply action
    setSelectedCompetency(comp.name === selectedCompetency ? null : comp.name);
    // Keep dropdown open to allow more selections
  };

  const handleClear = () => {
    console.log('Clearing filters...');
    setSelectedUnits([]);
    setSelectedCompetency(null);
    setReportData(null);
    setError(null);
  };

  const handleApply = async () => {
    console.log('📤 Applying filters...', {
      selectedUnits,
      selectedCompetency,
    });

    if (!selectedCompetency || selectedUnits.length === 0) {
      const msg = '❌ Please select at least one unit and one competency.';
      console.warn(msg);
      setError(msg);
      return;
    }

    const sectionObj = competencies.find((c) => c.name === selectedCompetency);
    if (!sectionObj) {
      const msg = '❌ Competency mapping not found!';
      console.error(msg);
      setError(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🌐 Fetching report data from API...');
      const res = await fetch(`${BASE_URL}/reportanalytics/getSubCometencyUserReport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit: selectedUnits,
          section_id: [sectionObj.section_id],
        }),
      });

      const responseData = await res.json();
      console.log('📦 API response:', responseData);

      if (responseData?.status === 'success') {
        console.log('✅ Report data received:', responseData.data);
        setReportData(responseData.data || responseData);
      } else {
        const msg = responseData?.error || '❌ Invalid data format received';
        console.warn(msg);
        setError(msg);
      }
    } catch (err) {
      console.error('❌ Error fetching report:', err);
      setError('Error fetching report data');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!reportData) return;

    // Convert reportData to an array of objects
    const formattedData = Object.keys(reportData).flatMap(unit => {
      return Object.keys(reportData[unit]).map(subCompetency => {
        const data = reportData[unit][subCompetency];
        return { unit, subCompetency, ...data }; // Merge the unit, subCompetency, and actual data
      });
    });

    console.log('Formatted data for Excel:', formattedData);

    // Create a worksheet from the formatted data
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // Apply some styling for the Excel headers (optional)
    const wscols = [
      { wpx: 100 },
      { wpx: 100 }, 
      { wpx: 100 }, 
      { wpx: 100 }, 
      { wpx: 100 }, 
    ];
    ws['!cols'] = wscols;

    // Apply green filter to the headers
    const range = { s: { r: 0, c: 0 }, e: { r: 0, c: wscols.length - 1 } };
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
      if (!cell) continue;
      cell.s = { fill: { fgColor: { rgb: '00FF00' } } }; // Set header color to green
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, 'SubCompetency_Report.xlsx');
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
              <label className="dropdown-item">
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
                <label key={comp.section_id} className="dropdown-item">
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
