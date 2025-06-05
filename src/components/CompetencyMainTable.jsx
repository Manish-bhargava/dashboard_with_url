import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
const CompetencyMainTable = ({ units, quizId, reportData: propReportData, onDataUpdate }) => {
  // State to manage competency data fetched from API
  const [competencyMap, setCompetencyMap] = useState(initialCompetencyMap);
  const [competencyValues, setCompetencyValues] = useState(initialCompetencyValues);
  const [competencyAbbreviations, setCompetencyAbbreviations] = useState({});
  const [apiDataLoaded, setApiDataLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCompetencies, setActiveCompetencies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableRows, setTableRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'none'
  });

  // Memoize the getSortIcon function
  const getSortIcon = useCallback((key) => {
    const icon = sortConfig.key !== key ? '↕️' :
                sortConfig.direction === 'asc' ? '↑' :
                sortConfig.direction === 'desc' ? '↓' : '↕️';
    return icon;
  }, [sortConfig]);

  // Memoize the getSortableValue function
  const getSortableValue = useCallback((row, key) => {
    if (key === 'sno') return row.sno;
    if (key === 'unitName') return row.unitName?.toLowerCase() || '';
    
    // Handle total score sorting
    if (key === 'totalScore') {
      let totalScore = 0;
      
      // Sum up all competency scores for this row
      Object.entries(row.competencies).forEach(([compName, compData]) => {
        const score = compData.avg === '-' ? 0 : parseFloat(compData.avg) || 0;
        totalScore += score;
      });
      
      return totalScore;
    }
    
    const match = key.match(/(score|percentile)_(.+)/);
    if (match) {
      const type = match[1];
      const sectionId = match[2];
      const competencyName = competencyMap[sectionId];
      
      const competencyData = row.competencies[competencyName];
      if (!competencyData) return 0;

      const value = type === 'percentile' ? 
        (competencyData.percentile === '-' ? 0 : parseFloat(competencyData.percentile) || 0) :
        (competencyData.avg === '-' ? 0 : parseFloat(competencyData.avg) || 0);

      return value;
    }
    return 0;
  }, [competencyMap]);

  // Memoize the handleSort function
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key: prev.key === key && prev.direction === 'desc' ? null : key,
      direction: prev.key === key ? 
        (prev.direction === 'none' ? 'asc' : 
         prev.direction === 'asc' ? 'desc' : 'none') : 
        'asc'
    }));
  }, []);

  // Memoize the processed and sorted data
  const processedAndSortedData = useMemo(() => {
    if (!tableRows.length) return [];

    // Process data
    const processed = tableRows.map((item, index) => ({
      ...item,
      sno: index + 1
    }));

    // Filter data
    const filtered = processed.filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return item.unitName?.toLowerCase().includes(searchLower);
    });

    // Sort data
    if (sortConfig.direction === 'none') return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = getSortableValue(a, sortConfig.key);
      const bValue = getSortableValue(b, sortConfig.key);

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      }

      return sortConfig.direction === 'asc' ? 
        aValue - bValue : 
        bValue - aValue;
    });
  }, [tableRows, searchTerm, sortConfig, getSortableValue]);

  // Memoize the renderPercentileBar function
  const renderPercentileBar = useCallback((value) => {
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
  }, []);

  // Update parent component with data changes
  useEffect(() => {
    if (onDataUpdate && tableRows.length > 0) {
      console.log('Sending data update to parent:', {
        rows: tableRows,
        activeCompetencies,
        competencyAbbreviations
      });

      // Make sure to include the EXACT maxScore values being displayed in the table
      const sections = activeCompetencies.map(({ id, name }) => ({
        id,
        name,
        abbreviation: competencyAbbreviations[id],
        // This is crucial - include the exact maxScore values used in the table display
        maxScore: competencyValues[id]
      }));

      // Calculate the total value displayed in the table
      const tableTotalPossibleScore = activeCompetencies.reduce(
        (sum, { id }) => sum + parseFloat(competencyValues[id] || 0), 
        0
      ).toFixed(1);

      const newData = {
        rows: tableRows,
        sections: sections,
        totalPossibleScore: tableTotalPossibleScore
      };

      onDataUpdate(newData);
    }
  }, [tableRows, activeCompetencies, competencyAbbreviations, onDataUpdate]);

  // Initialize abbreviations for the fallback data
  useEffect(() => {
    // Create abbreviation map for fallback data
    const initialAbbreviations = {};
    Object.entries(initialCompetencyMap).forEach(([id, name]) => {
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
        const response = await axios.post('/api/reportanalytics/getSubCompetency', {});
        
        const responseData = response.data;
        console.log('Full API Response from getSubCompetency:', JSON.stringify(responseData, null, 2));
        
        if (responseData.status === 'success' && Array.isArray(responseData.data)) {
          console.log('Competency Definition API Data:', JSON.stringify(responseData.data, null, 2));
          
          // Build competency map and values from API data
          const newCompetencyMap = {};
          const newCompetencyValues = {};
          
          responseData.data.forEach(section => {
            console.log('Processing section:', JSON.stringify(section, null, 2));
            
            // Handle quiz_section_id which can be either an array or a string
            let sectionId;
            if (Array.isArray(section.quiz_section_id)) {
              sectionId = section.quiz_section_id[0];
            } else if (typeof section.quiz_section_id === 'string') {
              sectionId = section.quiz_section_id;
            }

            if (sectionId) {
              newCompetencyMap[sectionId] = section.section_name;
              console.log(`Added to map: ${sectionId} -> ${section.section_name}`);
              
              // Calculate total marks for each section
              let totalMarks = 0;
              if (section.topics && Array.isArray(section.topics)) {
                console.log('Processing topics for section:', section.section_name);
                section.topics.forEach(topic => {
                  console.log('Topic:', JSON.stringify(topic, null, 2));
                  if (topic.total_marks) {
                    totalMarks += parseInt(topic.total_marks, 10);
                    console.log(`Added ${topic.total_marks} to total marks`);
                  }
                });
              }
              newCompetencyValues[sectionId] = totalMarks.toString();
              console.log(`Total marks for ${section.section_name}: ${totalMarks}`);
            } else {
              console.warn('Invalid quiz_section_id format:', section.quiz_section_id);
            }
          });
          
          // Create abbreviation map
          const newCompetencyAbbreviations = {};
          Object.entries(newCompetencyMap).forEach(([id, name]) => {
            newCompetencyAbbreviations[id] = getAbbreviation(name);
          });
          
          console.log('Generated Competency Map:', JSON.stringify(newCompetencyMap, null, 2));
          console.log('Generated Competency Values:', JSON.stringify(newCompetencyValues, null, 2));
          console.log('Generated Abbreviations:', JSON.stringify(newCompetencyAbbreviations, null, 2));
          
          setCompetencyMap(newCompetencyMap);
          setCompetencyValues(newCompetencyValues);
          setCompetencyAbbreviations(newCompetencyAbbreviations);
          setApiDataLoaded(true);
        } else {
          console.error('Invalid API response format:', JSON.stringify(responseData, null, 2));
          throw new Error('Invalid API response format for competency definitions');
        }
      } catch (error) {
        console.error('Error fetching competency definitions:', error);
        setApiError(error.message);
        setApiDataLoaded(true);
      }
    };
    
    fetchCompetencyData();
  }, []);
  
  // Set report data from props when it changes
  useEffect(() => {
    if (propReportData) {
      console.log('Received report data from props:', JSON.stringify(propReportData, null, 2));
      console.log('Report data status:', propReportData.status);
      console.log('Report data content:', JSON.stringify(propReportData.data, null, 2));
      setReportData(propReportData);
      setIsLoading(false);
    } else {
      console.log('No report data received from props');
    }
  }, [propReportData]);

  // Track if we've already filtered the competency map
  const [isFiltered, setIsFiltered] = useState(false);
  
  // Process table data when reportData and competency map are loaded or sort changes
  useEffect(() => {
    if (reportData && reportData.status === 'success' && reportData.data) {
      console.log('Processing report data:', reportData);
      
      // Build competency map from section details
      const newCompetencyMap = {};
      const newCompetencyValues = {};
      
      // Loop through each unit's data to build competency map
      Object.values(reportData.data).forEach(unitData => {
        if (unitData[quizId] && unitData[quizId].section_detail) {
          const sectionDetails = unitData[quizId].section_detail;
          Object.entries(sectionDetails).forEach(([sectionId, section]) => {
            if (section.section_name) {
              newCompetencyMap[sectionId] = section.section_name;
              newCompetencyValues[sectionId] = section.section_total_question || '0';
            }
          });
        }
      });
      
      // Update competency map and values
      setCompetencyMap(newCompetencyMap);
      setCompetencyValues(newCompetencyValues);
      
      // Create abbreviation map
      const newCompetencyAbbreviations = {};
      Object.entries(newCompetencyMap).forEach(([id, name]) => {
        newCompetencyAbbreviations[id] = getAbbreviation(name);
      });
      setCompetencyAbbreviations(newCompetencyAbbreviations);
      
      // Detect which competencies are present in the current data
      const presentSectionIds = new Set();
      
      Object.values(reportData.data).forEach(unitData => {
        const scoreDetail = unitData.score_detail || {};
        Object.keys(scoreDetail).forEach(sectionId => {
          const compData = scoreDetail[sectionId];
          if (compData && (compData.unit_section_score_average || compData.unit_section_score_percentile)) {
            presentSectionIds.add(sectionId);
          }
        });
      });
      
      // Filter competencies to only those present in data
      const activeCompetencyList = Array.from(presentSectionIds)
        .filter(id => newCompetencyMap[id] !== undefined)
        .map(id => ({
          id,
          name: newCompetencyMap[id]
        }));
      
      setActiveCompetencies(activeCompetencyList);
      
      // Process the data to create table rows
      const rows = [];
      let sno = 1;

      Object.entries(reportData.data).forEach(([unitName, unitData]) => {
        const row = {
          sno: sno++,
          unitName,
          competencies: {},
          totalScore: 0
        };

        const scoreDetail = unitData.score_detail || {};
        
        if (scoreDetail) {
          Object.entries(newCompetencyMap).forEach(([sectionId, competencyName]) => {
            const compData = scoreDetail[sectionId] || {};
            
            if (compData) {
              row.competencies[competencyName] = {
                avg: compData.unit_section_score_average ?? '-',
                percentile: compData.unit_section_score_percentile ?? '-'
              };
              
              if (compData.unit_section_score_average) {
                const score = parseFloat(compData.unit_section_score_average || 0);
                row.totalScore += score;
              }
            }
          });
        }

        rows.push(row);
      });

      console.log('Setting table rows:', rows);
      setTableRows(rows);
    }
  }, [reportData, quizId]);

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
<div style={{overflowX: "auto", width: "100%" }}>

      <table className="competency-table">
        <thead>
          <tr>
            <th 
              className="sortable-header"
              onClick={() => handleSort('sno')}
              style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, cursor: 'pointer' }}
            >
              S.No
              <span className="sort-arrows">
                {getSortIcon('sno')}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort('unitName')}
              style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, cursor: 'pointer' }}
            >
              Unit
              <span className="sort-arrows">
                {getSortIcon('unitName')}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort('totalScore')}
              style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, cursor: 'pointer' }}
            >
              Total Score (Out of {activeCompetencies.reduce((sum, { id }) => sum + parseFloat(competencyValues[id] || 0), 0).toFixed(1)})
              <span className="sort-arrows">
                {getSortIcon('totalScore')}
              </span>
            </th>
            {activeCompetencies.map(({ id: sectionId }) => {
              const abbr = competencyAbbreviations[sectionId];
              return (
                <React.Fragment key={sectionId}>
                  <th 
                    className="sortable-header"
                    onClick={() => handleSort(`score_${sectionId}`)}
                    style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, cursor: 'pointer' }}
                  >
                    {abbr} - Score (Out of {competencyValues[sectionId]})
                    <span className="sort-arrows">
                      {getSortIcon(`score_${sectionId}`)}
                    </span>
                  </th>
                  <th 
                    className="sortable-header-mh-percentile"
                    onClick={() => handleSort(`percentile_${sectionId}`)}
                    style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, cursor: 'pointer' }}
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
          {processedAndSortedData.length === 0 ? (
            <tr>
              <td colSpan={2 + Object.keys(competencyMap).length * 2}>
                No data available for the search term '{searchTerm}'
              </td>
            </tr>
          ) : (
            processedAndSortedData.map((row) => (
              <tr key={row.sno}>
                <td>{row.sno}</td>
                <td>{row.unitName}</td>
                <td>
                  {Object.entries(row.competencies).reduce((total, [compName, compData]) => {
                    const score = compData.avg === '-' ? 0 : parseFloat(compData.avg) || 0;
                    return total + score;
                  }, 0).toFixed(2)}
                </td>
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

    </div>
  );
};

export default React.memo(CompetencyMainTable);
