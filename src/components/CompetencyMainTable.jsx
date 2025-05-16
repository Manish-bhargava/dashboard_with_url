import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CompetencyTable.css';

// Will be populated from API
const initialCompetencyMap = {};
const initialCompetencyValues = {};

// Generate abbreviation from competency name
const getAbbreviation = (sectionName) => {
  // Split section name by spaces or forward slashes
  const words = sectionName.split(/[ \/]+/);
  // Create abbreviation from first letter of each word
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

// fall back data in case API fails
const fallbackCompetencyMap = {
  "85": "Leadership",
  "83": "Quality in Healthcare Delivery",
  "84": "Relationship Building",
  "82": "Situation Management"
};

const fallbackCompetencyValues = {
  "85": "36",
  "83": "48",
  "84": "54",
  "82": "42"
};

/**
 * CompetencyMainTable Component
 * 
 * Displays a table of competency metrics by unit, dynamically adjusting columns
 * based on the quiz selections. Uses an API to fetch competency definitions
 * and receives report data as props from parent component.
 * 
 * @param {Array} units - Selected units to display in the table
 * @param {number} quizId - The ID of the selected quiz/test
 * @param {Object} reportData - The API response data containing unit scores
 */
const CompetencyMainTable = ({ units, quizId, reportData: propReportData }) => {
  // State to manage competency data fetched from API
  const [competencyMap, setCompetencyMap] = useState(fallbackCompetencyMap); // Use fallback data as initial state
  const [competencyValues, setCompetencyValues] = useState(fallbackCompetencyValues); // Use fallback data as initial state
  const [competencyAbbreviations, setCompetencyAbbreviations] = useState({});
  const [apiDataLoaded, setApiDataLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // State to store active competencies from the current data
  const [activeCompetencies, setActiveCompetencies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableRows, setTableRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'none' // 'none', 'asc', 'desc'
  });

  const getSortableValue = (row, key) => {
    console.log('Getting sortable value for:', { row, key });
    
    // Handle basic fields
    if (key === 'sno') {
      const value = row.sno;
      console.log('S.No value:', value);
      return value;
    }
    if (key === 'unitName') {
      const value = row.unitName?.toLowerCase() || '';
      console.log('Unit Name value:', value);
      return value;
    }
    
    // Handle competency scores and percentiles
    const match = key.match(/(score|percentile)_(.+)/);
    if (match) {
      const type = match[1]; // 'score' or 'percentile'
      const sectionId = match[2];
      const competencyName = competencyMap[sectionId];
      
      console.log('Looking for competency:', {
        sectionId,
        competencyName,
        type,
        competencies: row.competencies
      });

      const competencyData = row.competencies[competencyName];
      if (!competencyData) {
        console.log('No matching competency found:', competencyName);
        return 0;
      }

      const value = type === 'percentile' ? 
        (competencyData.percentile === '-' ? 0 : parseFloat(competencyData.percentile) || 0) :
        (competencyData.avg === '-' ? 0 : parseFloat(competencyData.avg) || 0);

      console.log('Competency value:', {
        competencyName,
        type,
        rawValue: type === 'percentile' ? competencyData.percentile : competencyData.avg,
        parsedValue: value
      });
      return value;
    }

    console.log('No matching sort key found, returning 0');
    return 0;
  };

  const handleSort = (key) => {
    console.log('Sort clicked for key:', key);
    setSortConfig(prev => {
      const newConfig = {
        key: prev.key === key && prev.direction === 'desc' ? null : key,
        direction: prev.key === key ? 
          (prev.direction === 'none' ? 'asc' : 
           prev.direction === 'asc' ? 'desc' : 'none') : 
          'asc'
      };
      console.log('New sort config:', newConfig);
      return newConfig;
    });
  };

  const getSortIcon = (key) => {
    const icon = sortConfig.key !== key ? '↕️' :
                sortConfig.direction === 'asc' ? '↑' :
                sortConfig.direction === 'desc' ? '↓' : '↕️';
    console.log('Sort icon for', key, ':', icon);
    return icon;
  };

  // Initialize abbreviations for the fallback data
  useEffect(() => {
    // Create abbreviation map for fallback data
    const initialAbbreviations = {};
    Object.entries(fallbackCompetencyMap).forEach(([id, name]) => {
      initialAbbreviations[id] = getAbbreviation(name);
    });
    setCompetencyAbbreviations(initialAbbreviations);
    console.log('Created abbreviations for fallback data:', initialAbbreviations);
  }, []);

  // Fetch competency mapping information from API
  useEffect(() => {
    const fetchCompetencyData = async () => {
      try {
        console.log('Fetching competency definitions...');
        // Use axios with the proxy configured in vite.config.js
        const response = await axios.post('/api/reportanalytics/getSubCompetency', {});
        
        const responseData = response.data;
        
        if (responseData.status === 'success' && Array.isArray(responseData.data)) {
          console.log('Competency Definition API Data:', responseData.data);
          
          // Build competency map and values from API data
          const newCompetencyMap = {};
          const newCompetencyValues = {};
          
          responseData.data.forEach(section => {
            console.log('Processing section:', section.section_name, 'with quiz_section_id:', section.quiz_section_id);
            
            // Each section has quiz_section_id which is an array with 2 values
            // We'll use the second value as our section ID (e.g., "84")
            if (section.quiz_section_id && section.quiz_section_id.length > 1) {
              const sectionId = section.quiz_section_id[1];
              newCompetencyMap[sectionId] = section.section_name;
              console.log(`Added to map: ${sectionId} -> ${section.section_name}`);
              
              // Calculate total marks for each section
              let totalMarks = 0;
              if (section.topics && Array.isArray(section.topics)) {
                section.topics.forEach(topic => {
                  if (topic.total_marks) {
                    totalMarks += parseInt(topic.total_marks, 10);
                  }
                });
              }
              newCompetencyValues[sectionId] = totalMarks.toString();
              console.log(`Total marks for ${section.section_name}: ${totalMarks}`);
            }
          });
          
          // If API competency map is empty, continue using fallback data
          if (Object.keys(newCompetencyMap).length === 0) {
            console.log('API competency data is empty, using fallback data');
            setApiDataLoaded(true);
            return;
          }
          
          // Create abbreviation map
          const newCompetencyAbbreviations = {};
          Object.entries(newCompetencyMap).forEach(([id, name]) => {
            newCompetencyAbbreviations[id] = getAbbreviation(name);
          });
          
          console.log('Generated Competency Map:', newCompetencyMap);
          console.log('Generated Competency Values:', newCompetencyValues);
          console.log('Generated Abbreviations:', newCompetencyAbbreviations);
          
          setCompetencyMap(newCompetencyMap);
          setCompetencyValues(newCompetencyValues);
          setCompetencyAbbreviations(newCompetencyAbbreviations);
          setApiDataLoaded(true);
        } else {
          throw new Error('Invalid API response format for competency definitions');
        }
      } catch (error) {
        console.error('Error fetching competency definitions:', error);
        setApiError(error.message);
        
        // If there's an error, still set API data loaded and use fallback data
        setApiDataLoaded(true);
      }
    };
    
    fetchCompetencyData();
  }, []);
  
  // Set report data from props when it changes
  useEffect(() => {
    if (propReportData) {
      console.log('Received report data from props:', propReportData);
      setReportData(propReportData);
      setIsLoading(false);
    }
  }, [propReportData]);

  // Track if we've already filtered the competency map
  const [isFiltered, setIsFiltered] = useState(false);
  
  // Process table data when reportData and competency map are loaded or sort changes
  useEffect(() => {
    if (apiDataLoaded && reportData && reportData.status === 'success' && reportData.data) {
      console.log('Starting to process data in second useEffect...');
      console.log('Raw Report Data:', reportData.data);
      console.log('Current competencyMap:', competencyMap);
      console.log('Competency map keys available:', Object.keys(competencyMap));
      
      // We should have a competency map either from API or fallback data
      if (Object.keys(competencyMap).length === 0) {
        console.log('WARNING: Competency map is still empty despite fallback. Using emergency hardcoded values.');
        // Emergency fallback - hardcode values directly into processing step
        const emergencyMap = {
          "85": "Leadership",
          "83": "Quality in Healthcare Delivery",
          "84": "Relationship Building",
          "82": "Situation Management"
        };
        setCompetencyMap(emergencyMap);
        return;
      }
      
      // Only filter the competency map once to avoid infinite loops
      if (!isFiltered) {
        console.log('Filtering competency map for quiz_id:', quizId);
        
        // Instead of using the full competency map, filter it to only show sections that are
        // specific to the selected quiz_id
        const filteredCompetencyMap = {};
        
        // Loop through the report data (which may have multiple units)
        Object.entries(reportData.data).forEach(([unitName, unitData]) => {
          console.log(`Processing unit: ${unitName} for quiz_id: ${quizId}`);
          
          // Get quiz-specific section details
          if (quizId && unitData[quizId] && unitData[quizId].section_detail) {
            console.log(`Found quiz_id ${quizId} section details for unit ${unitName}`);
            
            // Get section IDs specific to this quiz from section_detail
            const quizSections = unitData[quizId].section_detail || {};
            Object.keys(quizSections).forEach(sectionId => {
              if (competencyMap[sectionId]) {
                filteredCompetencyMap[sectionId] = competencyMap[sectionId];
                console.log(`Added section for quiz ${quizId}: ${sectionId} - ${competencyMap[sectionId]}`);
              }
            });
          }
          
          // Also check the score_detail which may have all sections
          const scoreDetail = unitData.score_detail || {};
          if (quizId) {
            // Filter score_detail to only include sections for this quiz
            Object.keys(scoreDetail).forEach(sectionId => {
              // Only add if not already added from section_detail and exists in competency map
              if (!filteredCompetencyMap[sectionId] && competencyMap[sectionId]) {
                // Use the unit's quiz section data to verify this sectionId belongs to the selected quiz
                if (unitData[quizId] && 
                    unitData[quizId].section_detail && 
                    unitData[quizId].section_detail[sectionId]) {
                  filteredCompetencyMap[sectionId] = competencyMap[sectionId];
                  console.log(`Added section from score_detail: ${sectionId} - ${competencyMap[sectionId]}`);
                }
              }
            });
          }
        });
        
        console.log('Filtered competency map for quiz_id', quizId, ':', filteredCompetencyMap);
        
        // Only update if the filtered map is different from the current one
        // and has at least one entry
        if (Object.keys(filteredCompetencyMap).length > 0 && 
            JSON.stringify(filteredCompetencyMap) !== JSON.stringify(competencyMap)) {
          setCompetencyMap(filteredCompetencyMap);
          setIsFiltered(true); // Mark as filtered to avoid infinite loop
          return; // Will re-run this effect with the updated map
        } else {
          // Mark as filtered even if we didn't change the map
          setIsFiltered(true);
        }
      }
      
      // Detect which competencies are present in the current data
      const presentSectionIds = new Set();
      
      Object.values(reportData.data).forEach(unitData => {
        console.log('Processing unit data:', unitData);
        const scoreDetail = unitData.score_detail || {};
        console.log('Score detail:', scoreDetail);
        
        Object.keys(scoreDetail).forEach(sectionId => {
          const compData = scoreDetail[sectionId];
          console.log(`Checking section ID: ${sectionId}, Data:`, compData);
          if (compData && (compData.unit_section_score_average || compData.unit_section_score_percentile)) {
            console.log(`Adding section ID: ${sectionId} to presentSectionIds`);
            presentSectionIds.add(sectionId);
          }
        });
      });
      
      console.log('Present section IDs:', Array.from(presentSectionIds));
      console.log('Competency map keys:', Object.keys(competencyMap));
      
      // Filter competencies to only those present in data
      const activeCompetencyList = Array.from(presentSectionIds)
        .filter(id => {
          const exists = competencyMap[id] !== undefined;
          console.log(`Section ID: ${id}, Exists in competencyMap: ${exists}`);
          return exists;
        })
        .map(id => ({
          id,
          name: competencyMap[id]
        }));
      
      console.log('Final Active competencies:', activeCompetencyList);
      setActiveCompetencies(activeCompetencyList);
      
      // Now process the data to create table rows
      processData();
    }
  }, [reportData, sortConfig, apiDataLoaded, competencyMap]);

  const processData = () => {
    const rows = [];
    let sno = 1;

    if (!reportData || !reportData.data) {
      console.log('No report data to process');
      setTableRows([]);
      return;
    }

    Object.entries(reportData.data).forEach(([unitName, unitData]) => {
      console.log('Processing Unit for table row:', unitName);
      console.log('Unit data:', unitData);
      
      // Create a row for the unit
      const row = {
        sno: sno++,
        unitName,
        competencies: {},
        totalScore: 0
      };

      // Process score details
      const scoreDetail = unitData.score_detail || {};
      console.log('Score details for unit:', scoreDetail);
      
      if (scoreDetail) {
        console.log('CompetencyMap being used:', competencyMap);
        
        // For each competency in our map, look for matching score data
        Object.entries(competencyMap).forEach(([sectionId, competencyName]) => {
          console.log(`Looking for section ID ${sectionId} (${competencyName}) in score details`);
          const compData = scoreDetail[sectionId] || {};
          console.log(`Found data for ${competencyName}:`, compData);
          
          row.competencies[competencyName] = {
            avg: compData.unit_section_score_average ?? '-',
            percentile: compData.unit_section_score_percentile ?? '-'
          };
          
          console.log(`Added to row competencies:`, row.competencies[competencyName]);
          
          // Add to total score
          if (compData.unit_section_score_average) {
            const score = parseFloat(compData.unit_section_score_average || 0);
            row.totalScore += score;
            console.log(`Added ${score} to totalScore, now: ${row.totalScore}`);
          }
        });
      }

      console.log('Final row data:', row);
      rows.push(row);
    });

    // Sort rows based on sortConfig
    const sortedRows = [...rows].sort((a, b) => {
      if (sortConfig.direction === 'none') return 0;

      const aValue = getSortableValue(a, sortConfig.key);
      const bValue = getSortableValue(b, sortConfig.key);

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    console.log('Processed Rows:', sortedRows); // Debug log
    setTableRows(sortedRows);
  };

  const renderPercentileBar = (value) => {
    if (!value || value === '-') return '-';
    const percentage = parseFloat(value);
    if (isNaN(percentage)) return '-';
    
    return (
      <div className="percentile-cell-container">
        <div className="mini-percentile-bar">
          <div 
            className="mini-percentile-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="percentile-value">{percentage.toFixed(2)}</span>
      </div>
    );
  };

  // Process and sort data
  const processedAndSortedData = [...tableRows].map((item, index) => ({
    ...item,
    sno: index + 1
  }));

  console.log('Processed Data:', processedAndSortedData);

  // Filter data based on search term
  const filteredRows = processedAndSortedData.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const matches = item.unitName?.toLowerCase().includes(searchLower);
    console.log('Search filter:', { unitName: item.unitName, searchTerm, matches });
    return matches;
  });

  console.log('Filtered Data:', filteredRows);

  // Sort the filtered data
  const sortedData = [...filteredRows].sort((a, b) => {
    if (sortConfig.direction === 'none') {
      console.log('No sorting direction, returning 0');
      return 0;
    }

    const aValue = getSortableValue(a, sortConfig.key);
    const bValue = getSortableValue(b, sortConfig.key);

    console.log('Sorting values:', {
      key: sortConfig.key,
      direction: sortConfig.direction,
      aValue,
      bValue
    });

    // Handle string comparison for text fields
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const result = sortConfig.direction === 'asc' ? 
        aValue.localeCompare(bValue) : 
        bValue.localeCompare(aValue);
      console.log('String comparison result:', result);
      return result;
    }

    // Handle numeric comparison for scores and percentiles
    const result = sortConfig.direction === 'asc' ? 
      aValue - bValue : 
      bValue - aValue;
    console.log('Numeric comparison result:', result);
    return result;
  });

  console.log('Final Sorted Data:', sortedData);

  if (isLoading || !apiDataLoaded) {
    return (
      <div className="table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  if (apiError) {
    return <div className="no-data">Error loading competency data: {apiError}</div>;
  }

  if (!reportData || reportData.status !== 'success' || !reportData.data) {
    return <div className="no-data">No valid data provided.</div>;
  }
  
  // Show which quiz and units we're displaying
  const quizInfo = quizId ? `Quiz ID: ${quizId}` : 'No quiz selected';
  const unitInfo = units && units.length > 0 ? `Units: ${units.join(', ')}` : 'No units selected';

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by unit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      {/* Legend for abbreviations */}
      <div className="competency-legend">
        <p><strong>Legend:</strong></p>
        <ul className="legend-list">
          {activeCompetencies.map(({ id, name }) => (
            <li key={id}><strong>{competencyAbbreviations[id]}</strong> - {name}</li>
          ))}
        </ul>
      </div>
      <table className="competency-table">
        <thead>
          <tr>
            <th 
              className="sortable-header"
              onClick={() => handleSort('sno')}
            >
              S.No
              <span className="sort-arrows">
                {getSortIcon('sno')}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort('unitName')}
            >
              Unit
              <span className="sort-arrows">
                {getSortIcon('unitName')}
              </span>
            </th>
            {activeCompetencies.map(({ id: sectionId }) => {
              const abbr = competencyAbbreviations[sectionId];
              return (
                <React.Fragment key={sectionId}>
                  <th 
                    className="sortable-header"
                    onClick={() => handleSort(`score_${sectionId}`)}
                  >
                    {abbr} - Score ({competencyValues[sectionId]})
                    <span className="sort-arrows">
                      {getSortIcon(`score_${sectionId}`)}
                    </span>
                  </th>
                  <th 
                    className="sortable-header mh-percentile"
                    onClick={() => handleSort(`percentile_${sectionId}`)}
                  >
                    {abbr} - MH %ile
                    <span className="sort-arrows">
                      {getSortIcon(`percentile_${sectionId}`)}
                    </span>
                  </th>
                </React.Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={2 + Object.keys(competencyMap).length * 2}>
                No data available for the search term '{searchTerm}'
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => (
              <tr key={row.sno}>
                <td>{row.sno}</td>
                <td>{row.unitName}</td>
                {activeCompetencies.map(({ id: sectionId }) => (
                  <React.Fragment key={sectionId}>
                    <td>{row.competencies[competencyMap[sectionId]]?.avg}</td>
                    <td className="mh-percentile">
                      {renderPercentileBar(row.competencies[competencyMap[sectionId]]?.percentile)}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CompetencyMainTable;
