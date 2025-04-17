import { useEffect, useState } from 'react';
import './shared.css';
import UnitSubCompetencyTable from './UnitSubCompetencyTable';
import * as XLSX from 'xlsx';

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

  const competencies = [
    { name: 'Leadership', section_id: 85 },
    { name: 'Situation Management', section_id: 82 },
    { name: 'Quality in Healthcare Delivery', section_id: 83 },
    { name: 'Relationship Building', section_id: 84 },
  ];

  useEffect(() => {
    console.log('Initializing component...');
    const fetchUnits = async () => {
      try {
        console.log('Fetching units...');
        const res = await fetch('/api/reportanalytics/getUnitList', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        console.log('Units response:', data);

        if (data?.status === 'success') {
          const allUnits = [...data.units.North, ...data.units.South];
          setUnits(allUnits);
          console.log('✅ Units set:', allUnits);
        } else {
          setError('Failed to load units');
        }
      } catch (err) {
        console.error('❌ Error fetching units:', err);
        setError('Error loading units');
      }
    };

    fetchUnits();
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
    setSelectedCompetency(comp.name === selectedCompetency ? null : comp.name);
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
      const res = await fetch('/api/reportanalytics/getSubCometencyUserReport', {
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
      { wpx: 100 }, // Unit
      { wpx: 100 }, // Sub-Competency
      { wpx: 100 }, // Mentoring Score
      { wpx: 100 }, // Mentoring Unit Percentile
      { wpx: 100 }, // Mentoring MH Percentile
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/reportanalytics/getSubCometencyUserReport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit: selectedUnits,
            section_id: [selectedCompetency ? competencies.find(c => c.name === selectedCompetency).section_id : null],
          }),
        });
        const result = await response.json();
        setReportData(result);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedUnits, selectedCompetency]);

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div   className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-row">
        <div className="dropdown-container">
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

        <div className="dropdown-container">
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
          disabled={loading}
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
