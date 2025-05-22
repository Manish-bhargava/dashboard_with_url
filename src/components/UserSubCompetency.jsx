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
  const [competencyMappings, setCompetencyMappings] = useState({});
  const [topicMappings, setTopicMappings] = useState({});
  
  // Create refs for the dropdown components to detect clicks outside
  const unitsDropdownRef = useRef(null);
  const competencyDropdownRef = useRef(null);

  useEffect(() => {
    fetchUnitsFromAPI();
    fetchCompetenciesFromAPI();
    
    // Add a global click handler to close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (unitsDropdownRef.current && !unitsDropdownRef.current.contains(event.target)) {
        setShowUnitsDropdown(false);
      }
      
      if (competencyDropdownRef.current && !competencyDropdownRef.current.contains(event.target)) {
        setShowCompetencyDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
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
        const allUnits = Object.values(response.data.units).flat().sort();
        setUnits(allUnits);
      } else {
        setError('Failed to fetch units. Status not "success".');
      }
    } catch (error) {
      console.error('❌ Error fetching unit list:', error);
      setError('Failed to fetch units. Please try again.');
    }
  };

  const fetchCompetenciesFromAPI = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCompetency`, {});
      
      if (response.data.status === 'success' && Array.isArray(response.data.data)) {
        const mappings = {};
        const competencyList = new Set();
        
        response.data.data.forEach(section => {
          if (section.section_name && section.quiz_section_id) {
            mappings[section.section_name] = section.quiz_section_id[0];
            competencyList.add(section.section_name);
          }
        });
        
        setCompetencyMappings(mappings);
        setCompetencies(Array.from(competencyList));
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error fetching competencies:', error);
      setError('Failed to load competencies');
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
    // Clear the report data when competency selection changes
    if (comp !== selectedCompetency) {
      setReportData(null);
    }
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

    const sectionId = competencyMappings[selectedCompetency];
    if (!sectionId) {
      setError('Invalid competency selected.');
      return;
    }

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
    if (!reportData || !reportData.data) {
      setError('No data available to download. Please apply filters first.');
      return;
    }

    try {
      console.log('Starting Excel export with data:', reportData);
      const flatData = [];
      
      // Get relevant topics for the selected competency
      const relevantTopics = Object.entries(topicMappings)
        .filter(([, [, comp]]) => comp === selectedCompetency)
        .map(([topicId, [name]]) => ({ topicId, name }));

      console.log('Relevant topics for export:', relevantTopics);

      // Get the first unit's data to calculate total possible scores
      const firstUnit = Object.values(reportData.data)[0];
      const firstUser = firstUnit ? Object.values(firstUnit)[0] : null;
      const sectionDetail = firstUser?.section_detail;
      const correctMarks = sectionDetail ? parseFloat(sectionDetail.correct_marks || 0) : 0;

      // Process the data using the same logic as the table
      Object.entries(reportData.data).forEach(([unitName, sections]) => {
        console.log('Processing unit:', unitName);
        const topicStats = {};

        // First pass: collect all topic stats
        Object.values(sections).forEach((section) => {
          console.log('Processing section:', section);
          const topics = section.topic_detail || {};
          Object.entries(topics).forEach(([topicId, topic]) => {
            if (topicMappings[topicId] && topicMappings[topicId][1] === selectedCompetency) {
              if (!topicStats[topicId]) {
                topicStats[topicId] = {
                  scoreSum: 0,
                  mhPercentileSum: 0,
                  count: 0,
                };
              }

              const score = parseFloat(topic.unit_topic_score_average || 0);
              const mhPercentile = parseFloat(topic.unit_topic_score_percentile || 0);

              topicStats[topicId].scoreSum += isNaN(score) ? 0 : score;
              topicStats[topicId].mhPercentileSum += isNaN(mhPercentile) ? 0 : mhPercentile;
              topicStats[topicId].count += 1;
            }
          });
        });

        // Create row data with the same structure as the table
        const rowData = {
          'S.No': flatData.length + 1,
          'Unit': unitName,
        };
        
        // Calculate total score and total possible score
        let totalScore = 0;
        let totalPossibleScore = 0;
        
        // First loop to calculate totals
        relevantTopics.forEach(({ topicId, name }) => {
          const stats = topicStats[topicId];
          const topic = firstUser?.topic_detail?.[topicId];
          const totalQuestions = topic ? parseFloat(topic.topic_total_question || 0) : 0;
          const totalPossibleMarks = correctMarks * totalQuestions;
          
          totalPossibleScore += totalPossibleMarks;
          
          if (stats && stats.count > 0) {
            const unitAvgScore = stats.scoreSum / stats.count;
            totalScore += unitAvgScore;
          }
        });
        
        // Add Total Score column
        rowData[`Total Score (Out of ${totalPossibleScore.toFixed(1)})`] = totalScore.toFixed(2);

        // Now add individual topic data
        relevantTopics.forEach(({ topicId, name }) => {
          const stats = topicStats[topicId];
          const abbr = getAbbreviation(name);
          const topic = firstUser?.topic_detail?.[topicId];
          const totalQuestions = topic ? parseFloat(topic.topic_total_question || 0) : 0;
          const totalPossibleMarks = (correctMarks * totalQuestions).toFixed(1);
          
          if (stats && stats.count > 0) {
            const unitAvgScore = (stats.scoreSum / stats.count).toFixed(2);
            const mhPercentile = (stats.mhPercentileSum / stats.count).toFixed(2);
            
            rowData[`${abbr} - Score (Out of ${totalPossibleMarks})`] = unitAvgScore;
            rowData[`${abbr} - MH %ile`] = mhPercentile;
          } else {
            rowData[`${abbr} - Score (Out of ${totalPossibleMarks})`] = '-';
            rowData[`${abbr} - MH %ile`] = '-';
          }
        });

        console.log('Final row data:', rowData);
        flatData.push(rowData);
      });

      console.log('Processed data for Excel:', flatData);

      if (flatData.length === 0) {
        setError('No data available for the selected filters.');
        return;
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(flatData);

      // Add legend data below the main data
      const legendData = relevantTopics.map(({ topicId, name }) => {
        const topic = firstUser?.topic_detail?.[topicId];
        const totalQuestions = topic ? parseFloat(topic.topic_total_question || 0) : 0;
        const totalPossibleMarks = (correctMarks * totalQuestions).toFixed(1);
        return {
          'Abbreviation': getAbbreviation(name),
          'Full Topic Name': `${name} (Out of ${totalPossibleMarks})`
        };
      });

      console.log('Legend data:', legendData);

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

      // Set column widths - increased for better readability
      const columnWidths = [
        { wch: 10 },  // S.No
        { wch: 25 },  // Unit - increased width
        { wch: 30 },  // Total Score with Out of - increased width
      ];

      // Add dynamic column widths for topic-specific columns
      const topicColumns = Object.keys(flatData[0]).filter(key => 
        key.includes('Score') || key.includes('%ile')
      );
      topicColumns.forEach((key) => {
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'UnitWiseSubCompetencyReport');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Save file
      const fileName = `UnitWiseSubCompetencyReport_${selectedCompetency}_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log('Saving file:', fileName);
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      setError('Error generating Excel file. Please try again.');
    }
  };

  // Helper function to generate abbreviation from topic name
  const getAbbreviation = (topicName) => {
    const words = topicName.split(/[ \/]+/);
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  };

  // Add useEffect to fetch topic mappings
  useEffect(() => {
    const fetchTopicMappings = async () => {
      try {
        console.log('Fetching topic mappings from API...');
        const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCompetency`, {});
        
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          const mappings = {};
          
          response.data.data.forEach(section => {
            if (section.topics && Array.isArray(section.topics)) {
              section.topics.forEach(topic => {
                if (topic.topic_id && topic.topic_name) {
                  mappings[topic.topic_id] = [topic.topic_name, section.section_name];
                }
              });
            }
          });
          
          console.log('Generated topic mappings:', mappings);
          setTopicMappings(mappings);
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        console.error('Error fetching topic mappings:', error);
        setError('Failed to load topic mappings');
      }
    };

    fetchTopicMappings();
  }, []);

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
        <h2 className="report-title">User Wise Performance Report</h2>
        <p className="subtitle">Detailed analysis of user performance metrics</p>

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
