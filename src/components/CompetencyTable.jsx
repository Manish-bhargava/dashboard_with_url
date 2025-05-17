import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './CompetencyTable.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

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
                // Log the section data to debug
                console.log('Section data for', sectionId, ':', section);
                
                // Get the unit percentile score from the correct path
                const unitPercentileScore = section.unit_section_percentile_score || 
                                          section.unit_percentile_score || 
                                          section.unit_percentile || 
                                          '-';
                
                studentRecord.sectionDetail[sectionId] = {
                  calculated_score: section.section_total_score || '-',
                  section_percentile_score: section.section_percentile_score || '-',
                  unit_section_percentile_score: unitPercentileScore
                };

                // Log the processed section detail
                console.log('Processed section detail:', studentRecord.sectionDetail[sectionId]);

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
      console.log('Sample student data:', Array.from(newStudentMap.values())[0]);
      
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
    // First try to get score from headerScores
    if (headerScores[sectionId]) {
      return headerScores[sectionId];
    }

    // If not in headerScores, calculate from data
    if (!data) return 0;

    // Find the section that contains this topic
    for (const unitId in data) {
      const unit = data[unitId];
      if (!unit.quiz_detail) continue;

      for (const quizId in unit.quiz_detail) {
        const quiz = unit.quiz_detail[quizId];
        if (!quiz) continue;

        for (const studentId in quiz) {
          const studentData = quiz[studentId];
          if (!studentData?.quiz_detail?.[quizId]?.section_detail?.[sectionId]) continue;

          const section = studentData.quiz_detail[quizId].section_detail[sectionId];
          // Just use correct_marks as the total score
          if (section.correct_marks) {
            const correctMarks = parseFloat(section.correct_marks);
            if (!isNaN(correctMarks)) {
              return correctMarks.toFixed(1);
            }
          }
        }
      }
    }

    return 0;
  };

  const calculateTotalPossibleScore = () => {
    if (!data) return 0;
    let totalScore = 0;

    // Sum up all section scores
    Array.from(sectionNames).forEach(sectionId => {
      const score = calculateTotalScore(sectionId);
      totalScore += parseFloat(score) || 0;
    });

    console.log('Total Possible Score:', totalScore);
    return totalScore.toFixed(1);
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

  const handleExport = () => {
    if (!data || !selectedQuizId) {
      setError('No data available to download. Please apply filters first.');
      return;
    }

    try {
      console.log('Starting Excel export with data:', data);
      const flatData = [];
      
      // Process the data using the same logic as the table
      Array.from(studentMap.values()).forEach((student, index) => {
        const rowData = {
          'S.No': index + 1,
          'Student Name': student.studentName,
          'Department': student.department,
          [`Total Score (Out of ${calculateTotalPossibleScore()})`]: student.totalScore
        };

        // Add section data with scores
        Array.from(sectionNames).forEach(sectionId => {
          const section = student.sectionDetail[sectionId];
          const abbr = competencyAbbreviations[sectionId];
          const totalScore = headerScores[sectionId] || '0';
          
          if (section) {
            rowData[`${abbr} - Score (Out of ${totalScore})`] = section.calculated_score || '-';
            rowData[`${abbr} - MH %ile`] = section.section_percentile_score || '-';
            rowData[`${abbr} - Unit %ile`] = section.unit_section_percentile_score || '-';
          } else {
            rowData[`${abbr} - Score (Out of ${totalScore})`] = '-';
            rowData[`${abbr} - MH %ile`] = '-';
            rowData[`${abbr} - Unit %ile`] = '-';
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
      const legendData = Array.from(sectionNames).map(sectionId => {
        const totalScore = headerScores[sectionId] || '0';
        return {
          'Abbreviation': competencyAbbreviations[sectionId],
          'Full Competency Name': `${activeCompetencyMap[sectionId]} (Out of ${totalScore})`
        };
      });

      console.log('Legend data:', legendData);

      // Add a blank row
      XLSX.utils.sheet_add_aoa(worksheet, [['']], { origin: 'A' + (flatData.length + 2) });
      
      // Add legend header
      XLSX.utils.sheet_add_aoa(worksheet, [['Legend:']], { origin: 'A' + (flatData.length + 3) });
      
      // Add legend data
      legendData.forEach((item, index) => {
        XLSX.utils.sheet_add_aoa(worksheet, [[`${item.Abbreviation} - ${item['Full Competency Name']}`]], 
          { origin: 'A' + (flatData.length + 4 + index) });
      });

      // Set column widths
      const columnWidths = [
        { wch: 10 },  // S.No
        { wch: 30 },  // Student Name
        { wch: 20 },  // Department
        { wch: 30 },  // Total Score (increased to fit "Out of X")
      ];

      // Add dynamic column widths for competency-specific columns
      const competencyColumns = Object.keys(flatData[0]).filter(key => 
        key.includes('Score') || key.includes('%ile')
      );
      competencyColumns.forEach(() => {
        columnWidths.push({ wch: 25 }); // Increased width to accommodate "Out of X"
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CompetencyReport');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Save file
      const fileName = `CompetencyReport_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log('Saving file:', fileName);
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      setError('Error generating Excel file. Please try again.');
    }
  };

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
              Total Score (Out of {calculateTotalPossibleScore()})
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            {Array.from(sectionNames).map(sectionId => {
              const abbr = competencyAbbreviations[sectionId] || getAbbreviation(activeCompetencyMap[sectionId] || 'Unknown');
              const totalScore = calculateTotalScore(sectionId);
              return (
                <React.Fragment key={sectionId}>
                  <th 
                    className="sortable-header"
                    onClick={() => handleSort()}
                  >
                    {abbr} - Score (Out of {totalScore})
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
                  <th 
                    className="sortable-header unit-percentile"
                    onClick={() => handleSort()}
                  >
                    {abbr} - Unit %ile
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
              <td colSpan={4 + Array.from(sectionNames).length * 3} className="no-data-message">
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
                    <td className="unit-percentile">
                      {renderPercentileBar(row.sectionDetail[sectionId]?.unit_section_percentile_score || '-')}
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
