import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './shared.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import UserSubCompetencyTable from './UserSubCompetencyTable';
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

axios.defaults.withCredentials = true;

//
const UserSubCompetency = () => {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedCompetency, setSelectedCompetency] = useState('');
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showCompetencyDropdown, setShowCompetencyDropdown] = useState(false);
  const [units, setUnits] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const competencyDropdownRef = useRef(null);

  const competencyToSectionId = {
    'Situation Management': 82,
    'Quality in Healthcare Delivery': 83,
    'Relationship Building': 84,
    'Leadership': 85,
  };

  const allowedCompetencies = Object.keys(competencyToSectionId);

  useEffect(() => {
    fetchUnitsFromAPI();
    fetchCompetenciesFromAPI();
    
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

  const fetchUnitsFromAPI = async () => {
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

  const fetchCompetenciesFromAPI = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${BASE_URL}/reportanalytics/getMainCompetency`, {});         
      if (res.data?.status === 'success' && Array.isArray(res.data.data)) {
        const allSections = res.data.data.flatMap((entry) => entry.sections);
        const filteredCompetencies = allowedCompetencies.filter((comp) =>
          allSections.some((section) => section.section_name === comp)
        );
        setCompetencies(filteredCompetencies);
      } else {
        setCompetencies(allowedCompetencies);
      }
    } catch {
      setCompetencies(allowedCompetencies);
    } finally {
      setLoading(false);
    }
  };              

  const handleUnitSelect = (unit) => {
    setSelectedUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
  };

  const handleCompetencySelect = (comp) => {
    setSelectedCompetency((prev) => (prev === comp ? '' : comp));
  };

  const handleClear = () => {
    setSelectedUnits([]);
    setSelectedCompetency('');
    setReportData(null);
    setError(null);
  };

  const handleApply = async () => {
    if (selectedUnits.length === 0 || !selectedCompetency) {
      setError('Please select both Units and a Competency.');
      return;
    }

    const sectionId = competencyToSectionId[selectedCompetency];

    const requestBody = {
      unit: selectedUnits,
      section_id: [sectionId],
    };

    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(
        `${BASE_URL}/reportanalytics/getSubCometencyUnitReport`,
        requestBody
      );
      console.log('Sub Competency Unit Report API Response:', response.data);
      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) {
      setError('No data available to download. Please apply filters first.');
      return;
    }

    try {
      const flatData = [];
      Object.entries(reportData.data).forEach(([location, users]) => {
        Object.entries(users).forEach(([userId, userData]) => {
          const basicInfo = userData.user_basic_detail || {};
          Object.entries(userData.section_detail || {}).forEach(([sectionId, section]) => {
            Object.entries(section.topic_detail || {}).forEach(([topicId, topic]) => {
              flatData.push({
                Location: location,
                'User ID': userId,
                Name: basicInfo.student_name || 'N/A',
                Department: basicInfo.department || 'N/A',
                Section: section.section_name || 'N/A',
                'Topic ID': topicId,
                'Topic Score': topic.topic_total_score || '0',
                'Topic Percentile': topic.topic_percentile_score || '0',
                'Unit Topic Percentile': topic.unit_topic_percentile_score || '0',
              });
            });
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(flatData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sub Competency Report');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'sub_competency_report.xlsx');
    } catch {
      setError('Error generating Excel file. Please try again.');
    }
  };

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
            <span>{selectedUnits.length ? `${selectedUnits.length} Unit(s) Selected` : 'Select Units'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={() =>
                    setSelectedUnits(selectedUnits.length === units.length ? [] : [...units])
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

        <div className="dropdown-container" ref={competencyDropdownRef}>
          <div
            className="dropdown-header"
            onClick={() => setShowCompetencyDropdown(!showCompetencyDropdown)}
          >
            <span>{selectedCompetency || 'Select Competency'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showCompetencyDropdown && (
            <div className="dropdown-menu">
              {competencies.map((comp) => (
                <label key={comp} className="dropdown-item">
                  <input
                    type="radio"
                    name="competency"
                    checked={selectedCompetency === comp}
                    onChange={() => handleCompetencySelect(comp)}
                  />
                  {comp}
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="apply-btn" onClick={handleApply} disabled={loading}>
          {loading ? 'Applying...' : ' Apply'}
        </button>
        <button className="clear-btn" onClick={handleClear} disabled={loading}>
           Clear
        </button>
       
        <button className="excel-btn" onClick={handleExport} disabled={loading}>
           Excel
        </button>
      </div>

      <div className="report-content">
        <h2>User Wise Sub Competency Report</h2>
        <p className="subtitle">Detailed analysis of user sub competencies</p>

        <div className="report-data">
          {loading ? (
            <div className="loading-message">Loading...</div>
          ) : reportData ? (
            <UserSubCompetencyTable 
              data={reportData} 
              selectedCompetency={selectedCompetency}
              searchTerm={searchTerm}
            />
          ) : (
            <div className="no-filters-message">
              Please select filters and click "Apply" to view data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSubCompetency;
