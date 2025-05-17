import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './CompetencyTable.css';

// Generate abbreviation from competency name
const getAbbreviation = (sectionName) => {
  // Split section name by spaces or forward slashes
  const words = sectionName.split(/[ \/]+/);
  // Create abbreviation from first letter of each word
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

const CompetencyTable = ({ data, searchTerm: initialSearchTerm = '', selectedQuizId, onDataUpdate }) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(initialSearchTerm);
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [headerScores, setHeaderScores] = useState({});
  const [studentMap, setStudentMap] = useState(new Map());
  const [activeCompetencyMap, setActiveCompetencyMap] = useState({});
  const [quizSpecificSections, setQuizSpecificSections] = useState(new Set());
  const [competencyAbbreviations, setCompetencyAbbreviations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Update local search term when prop changes
  useEffect(() => {
    setLocalSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  // Fetch competency definitions from API
  const fetchCompetencyData = useCallback(async () => {
    try {
      console.log('Fetching competency definitions...');
      const response = await axios.post('/api/reportanalytics/getSubCompetency', {});
      
      const responseData = response.data;
      console.log('Full API Response from getSubCompetency:', JSON.stringify(responseData, null, 2));
      
      if (responseData.status === 'success' && Array.isArray(responseData.data)) {
        console.log('Competency Definition API Data:', JSON.stringify(responseData.data, null, 2));
        
        // Build competency map from API data
        const newCompetencyMap = {};
        const newCompetencyAbbreviations = {};
        
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
            newCompetencyAbbreviations[sectionId] = getAbbreviation(section.section_name);
            console.log(`Added to map: ${sectionId} -> ${section.section_name}`);
          } else {
            console.warn('Invalid quiz_section_id format:', section.quiz_section_id);
          }
        });
        
        console.log('Generated Competency Map:', JSON.stringify(newCompetencyMap, null, 2));
        console.log('Generated Abbreviations:', JSON.stringify(newCompetencyAbbreviations, null, 2));
        
        setActiveCompetencyMap(newCompetencyMap);
        setCompetencyAbbreviations(newCompetencyAbbreviations);
        setIsLoading(false);
      } else {
        console.error('Invalid API response format:', JSON.stringify(responseData, null, 2));
        throw new Error('Invalid API response format for competency definitions');
      }
    } catch (error) {
      console.error('Error fetching competency definitions:', error);
      setApiError(error.message);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetencyData();
  }, [fetchCompetencyData]);

  // Process data and update state
  useEffect(() => {
    if (data && typeof data === 'object' && Object.keys(activeCompetencyMap).length > 0 && selectedQuizId) {
      console.log('Processing data with competency map:', activeCompetencyMap);
      console.log('Selected Quiz ID:', selectedQuizId);
      console.log('Raw data:', JSON.stringify(data, null, 2));
      
      const scores = {};
      const newStudentMap = new Map();
      const sectionsInSelectedQuiz = new Set();

      // First pass: identify sections in the selected quiz
      Object.entries(data).forEach(([unitId, unit]) => {
        const quizDetails = unit.quiz_detail || {};
        if (quizDetails[selectedQuizId]) {
          const quiz = quizDetails[selectedQuizId];
          Object.entries(quiz).forEach(([studentId, studentData]) => {
            const sectionDetail = studentData.quiz_detail?.[selectedQuizId]?.section_detail || {};
            Object.keys(sectionDetail).forEach(sectionId => {
              sectionsInSelectedQuiz.add(sectionId);
            });
          });
        }
      });

      console.log('Sections in selected quiz:', Array.from(sectionsInSelectedQuiz));

      // Second pass: process data for identified sections
      Object.entries(data).forEach(([unitId, unit]) => {
        const quizDetails = unit.quiz_detail || {};
        if (quizDetails[selectedQuizId]) {
          const quiz = quizDetails[selectedQuizId];
          Object.entries(quiz).forEach(([studentId, studentData]) => {
            const userDetails = studentData.user_basic_detail || {};
            const studentName = userDetails.student_name || '-';
            const unitName = userDetails.unit_name || unitId;
            const department = userDetails.department || '-';
            const totalScore = studentData.total_score?.[selectedQuizId] || 0;
            const leadershipInitialScore = studentData.leadership_initial_score || '-';

            if (!newStudentMap.has(studentId)) {
              newStudentMap.set(studentId, {
                studentId,
                studentName,
                department,
                leadershipInitialScore,
                units: new Set([unitName]),
                totalScore: parseFloat(totalScore) || 0,
                sectionDetail: {}
              });
            } else {
              const existingRecord = newStudentMap.get(studentId);
              existingRecord.units.add(unitName);
              existingRecord.totalScore = Math.max(existingRecord.totalScore, parseFloat(totalScore) || 0);
            }

            const sectionDetail = studentData.quiz_detail?.[selectedQuizId]?.section_detail || {};
            const studentRecord = newStudentMap.get(studentId);
            
            Object.entries(sectionDetail).forEach(([sectionId, section]) => {
              if (sectionsInSelectedQuiz.has(sectionId)) {
                studentRecord.sectionDetail[sectionId] = {
                  calculated_score: section.section_total_score || '-',
                  section_percentile_score: section.section_percentile_score || '-',
                  unit_section_percentile_score: section.unit_section_percentile_score || '-'
                };

                if (section.correct_marks && section.section_total_question) {
                  const calculatedScore = parseFloat(section.correct_marks) * parseFloat(section.section_total_question);
                  if (!scores[sectionId] || calculatedScore > parseFloat(scores[sectionId])) {
                    scores[sectionId] = calculatedScore.toFixed(2);
                  }
                }
              }
            });
          });
        }
      });
      
      console.log('Processed data length:', newStudentMap.size);
      console.log('Section names:', Array.from(sectionsInSelectedQuiz).map(id => activeCompetencyMap[id] || id));
      
      setQuizSpecificSections(sectionsInSelectedQuiz);
      setHeaderScores(scores);
      setStudentMap(newStudentMap);
    }
  }, [data, activeCompetencyMap, selectedQuizId]);

  const handleSort = () => {
    setSortOrder(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const calculateTotalScore = (sectionId) => {
    return headerScores[sectionId] || '-';
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

  // Process data for display and export
  const processedData = Array.from(studentMap.values())
    .filter(item => {
      if (!localSearchTerm) return true;
      const searchLower = localSearchTerm.toLowerCase();
      return (
        item.studentName.toLowerCase().includes(searchLower) ||
        Array.from(item.units).some(unit => unit.toLowerCase().includes(searchLower)) ||
        item.department.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'none') return 0;
      if (sortOrder === 'asc') return a.totalScore - b.totalScore;
      return b.totalScore - a.totalScore;
    });

  // Get section names for the selected quiz
  const sectionNames = new Set();
  processedData.forEach(row => {
    Object.keys(row.sectionDetail).forEach(sectionId => {
      if (activeCompetencyMap[sectionId] && quizSpecificSections.has(sectionId)) {
        sectionNames.add(sectionId);
      }
    });
  });

  // Notify parent of data changes
  useEffect(() => {
    if (onDataUpdate && processedData.length > 0) {
      onDataUpdate({
        rows: processedData,
        sections: Array.from(sectionNames).map(id => ({
          id,
          name: activeCompetencyMap[id],
          abbreviation: competencyAbbreviations[id]
        })),
        headerScores
      });
    }
  }, [processedData, sectionNames, activeCompetencyMap, competencyAbbreviations, headerScores, onDataUpdate]);

  const filteredData = useMemo(() => {
    console.log('Filtering data with search term:', localSearchTerm);
    if (!localSearchTerm) return processedData;

    const searchLower = localSearchTerm.toLowerCase();
    return processedData.filter(row => {
      // Search in all relevant fields
      return (
        // Search in basic fields
        (row.studentName?.toLowerCase().includes(searchLower)) ||
        (row.department?.toLowerCase().includes(searchLower)) ||
        (row.totalScore?.toString().includes(searchLower)) ||
        
        // Search in competency scores and percentiles
        Object.values(row.sectionDetail).some(section => {
          const sectionName = section.calculated_score?.toLowerCase() || '';
          const sectionScore = String(section.calculated_score || '').toLowerCase();
          const sectionPercentile = String(section.section_percentile_score || '').toLowerCase();
          
          return sectionName.includes(searchLower) || 
                 sectionScore.includes(searchLower) || 
                 sectionPercentile.includes(searchLower);
        })
      );
    });
  }, [processedData, localSearchTerm]);

  console.log('Filtered Data:', filteredData);

  const sortedData = useMemo(() => {
    if (sortOrder === 'none') {
      console.log('No sorting direction, returning filtered data');
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = getSortableValue(a, sortOrder);
      const bValue = getSortableValue(b, sortOrder);

      console.log('Sorting values:', {
        key: sortOrder,
        direction: sortOrder,
        aValue,
        bValue
      });

      // Handle string comparison for text fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = sortOrder === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
        console.log('String comparison result:', result);
        return result;
      }

      // Handle numeric comparison for scores and percentiles
      const result = sortOrder === 'asc' ? 
        aValue - bValue : 
        bValue - aValue;
      console.log('Numeric comparison result:', result);
      return result;
    });
  }, [filteredData, sortOrder]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading competency data...</div>
      </div>
    );
  }

  if (apiError) {
    return <div className="no-data-message">Error loading competency data: {apiError}</div>;
  }

  if (!data || typeof data !== 'object') {
    return (
      <div className="no-data-message">
        <p>No data available. Please check if the data is being loaded correctly.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by unit, department, competency, score, or percentile..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      {/* Legend for abbreviations */}
      <div className="competency-legend">
        <p><strong>Legend:</strong></p>
        <ul className="legend-list">
          {Array.from(sectionNames).map(sectionId => (
            <li key={sectionId}>
              <strong>{competencyAbbreviations[sectionId]}</strong> - {activeCompetencyMap[sectionId]}
            </li>
          ))}
        </ul>
      </div>
      <table className="competency-table">
        <thead>
          <tr>
            <th 
              className="sortable-header"
              onClick={() => handleSort()}
            >
              S.No
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort()}
            >
              Student Name
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort()}
            >
              Department
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort()}
            >
              Total Score
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            {Array.from(sectionNames).map(sectionId => {
              const abbr = competencyAbbreviations[sectionId] || getAbbreviation(activeCompetencyMap[sectionId] || 'Unknown');
              return (
                <React.Fragment key={sectionId}>
                  <th 
                    className="sortable-header"
                    onClick={() => handleSort()}
                  >
                    {abbr} - Score
                    <span className="sort-arrows">
                      {sortOrder === 'none' && '↕️'}
                      {sortOrder === 'asc' && '↑'}
                      {sortOrder === 'desc' && '↓'}
                    </span>
                  </th>
                  <th 
                    className="sortable-header mh-percentile"
                    onClick={() => handleSort()}
                  >
                    {abbr} - MH %ile
                    <span className="sort-arrows">
                      {sortOrder === 'none' && '↕️'}
                      {sortOrder === 'asc' && '↑'}
                      {sortOrder === 'desc' && '↓'}
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
              <td colSpan={4 + Array.from(sectionNames).length * 2} className="no-data-message">
                No data available for the search term '{localSearchTerm}'
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => (
              <tr key={row.studentId}>
                <td>{index + 1}</td>
                <td>{row.studentName}</td>
                <td>{row.department}</td>
                <td>{row.totalScore}</td>
                {Array.from(sectionNames).map(sectionId => (
                  <React.Fragment key={sectionId}>
                    <td>{row.sectionDetail[sectionId]?.calculated_score || '-'}</td>
                    <td className="mh-percentile">
                      {renderPercentileBar(row.sectionDetail[sectionId]?.section_percentile_score || '-')}
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

export default CompetencyTable;
