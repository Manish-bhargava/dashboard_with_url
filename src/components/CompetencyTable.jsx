import React, { useState, useEffect } from 'react';
import './CompetencyTable.css';

const competencyMap = {
  "85": "Leadership",
  "83": "Quality in Healthcare Delivery",
  "84": "Relationship Building",
  "82": "Situation Management"
};

// Generate abbreviation from competency name
const getAbbreviation = (sectionName) => {
  // Split section name by spaces or forward slashes
  const words = sectionName.split(/[ \/]+/);
  // Create abbreviation from first letter of each word
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

// Create abbreviation map
const competencyAbbreviations = {};
Object.entries(competencyMap).forEach(([id, name]) => {
  competencyAbbreviations[id] = getAbbreviation(name);
});

const CompetencyTable = ({ data }) => {
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [headerScores, setHeaderScores] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [studentMap, setStudentMap] = useState(new Map());

  useEffect(() => {
    if (data && typeof data === 'object') {
      const scores = {};
      const newStudentMap = new Map();

      // Process all units to find the first valid score for each competency
      Object.entries(data).forEach(([unitId, unit]) => {
        const quizDetails = unit.quiz_detail || {};
        Object.entries(quizDetails).forEach(([quizId, quiz]) => {
          Object.entries(quiz).forEach(([studentId, studentData]) => {
            const userDetails = studentData.user_basic_detail || {};
            const studentName = userDetails.student_name || '-';
            const unitName = userDetails.unit_name || unitId;
            const department = userDetails.department || '-';
            const totalScore = studentData.total_score?.[quizId] || 0;
            const leadershipInitialScore = studentData.leadership_initial_score || '-';

            // Create or update student record
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

            // Process section details
            const sectionDetail = studentData.quiz_detail?.[quizId]?.section_detail || {};
            const studentRecord = newStudentMap.get(studentId);
            Object.entries(sectionDetail).forEach(([sectionId, section]) => {
              if (!studentRecord.sectionDetail[sectionId]) {
                studentRecord.sectionDetail[sectionId] = {
                  calculated_score: section.section_total_score || '-',
                  section_percentile_score: section.section_percentile_score || '-',
                  unit_section_percentile_score: section.unit_section_percentile_score || '-'
                };
              }

              // Update header scores
              if (section.correct_marks && section.section_total_question) {
                const calculatedScore = parseFloat(section.correct_marks) * parseFloat(section.section_total_question);
                if (!scores[sectionId] || calculatedScore > parseFloat(scores[sectionId])) {
                  scores[sectionId] = calculatedScore.toFixed(2);
                }
              }
            });
          });
        });
      });

      setHeaderScores(scores);
      setStudentMap(newStudentMap);
    }
  }, [data]);

  const handleSort = () => {
    setSortOrder(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  if (!data || typeof data !== 'object') {
    return (
      <div className="no-data-message">
        <p>No data available. Please check if the data is being loaded correctly.</p>
      </div>
    );
  }

  // Convert Map to array and filter/sort
  const processedData = Array.from(studentMap.values())
    .filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
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

  // Get unique section names from all rows
  const sectionNames = new Set();
  processedData.forEach(row => {
    Object.keys(row.sectionDetail).forEach(sectionId => {
      if (competencyMap[sectionId]) {
        sectionNames.add(sectionId);
      }
    });
  });

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

  const calculateTotalScore = (sectionId) => {
    return headerScores[sectionId] || '-';
  };

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name, unit, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      {/* Legend for abbreviations */}
      <div className="competency-legend">
        <p><strong>Legend:</strong></p>
        <ul className="legend-list">
          {Object.entries(competencyMap).map(([id, name]) => (
            <li key={id}><strong>{competencyAbbreviations[id]}</strong> - {name}</li>
          ))}
        </ul>
      </div>
      <table className="competency-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Student Name</th>
            <th>Units</th>
            <th>Department</th>
            <th 
              className="sortable-header"
              onClick={handleSort}
            >
              Total Score
              <span className="sort-arrows">
                {sortOrder === 'none' && '↕️'}
                {sortOrder === 'asc' && '↑'}
                {sortOrder === 'desc' && '↓'}
              </span>
            </th>
            {Array.from(sectionNames).map(sectionId => {
              const abbr = competencyAbbreviations[sectionId];
              return (
                <React.Fragment key={sectionId}>
                  <th>{abbr} - Score ({calculateTotalScore(sectionId)})</th>
                  <th>{abbr} - MH %ile</th>
                  <th>{abbr} - Unit %ile</th>
                </React.Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {processedData.map((row, index) => (
            <tr key={row.studentId}>
              <td>{index + 1}</td>
              <td>{row.studentName}</td>
              <td>{Array.from(row.units).join(', ')}</td>
              <td>{row.department}</td>
              <td>{row.totalScore}</td>
              {Array.from(sectionNames).map(sectionId => (
                <React.Fragment key={sectionId}>
                  <td>{row.sectionDetail[sectionId]?.calculated_score || '-'}</td>
                  <td>{renderPercentileBar(row.sectionDetail[sectionId]?.section_percentile_score || '-')}</td>
                  <td>{renderPercentileBar(row.sectionDetail[sectionId]?.unit_section_percentile_score || '-')}</td>
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompetencyTable;
