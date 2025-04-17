import React, { useState, useEffect } from 'react';
import './CompetencyTable.css';

const competencyMap = {
  "85": "Leadership",
  "83": "Quality in Healthcare Delivery",
  "84": "Relationship Building",
  "82": "Situation Management"
};

const CompetencyTable = ({ data }) => {
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [headerScores, setHeaderScores] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (data && typeof data === 'object') {
      const scores = {};

      // Process all units to find the first valid score for each competency
      Object.entries(data).forEach(([unitId, unit]) => {
        const quizDetails = unit.quiz_detail || {};
        Object.entries(quizDetails).forEach(([quizId, quiz]) => {
          Object.values(quiz).forEach(student => {
            const sectionDetail = student.quiz_detail?.[quizId]?.section_detail || {};
            Object.entries(sectionDetail).forEach(([sectionId, section]) => {
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

      console.log("Calculated header scores:", scores);
      setHeaderScores(scores);
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

  // Process data and create table rows
  const processedData = Object.entries(data).map(([key, value]) => {
    const quizDetails = value.quiz_detail || {};
    const rows = [];

    Object.entries(quizDetails).forEach(([quizId, studentMap]) => {
      Object.entries(studentMap).forEach(([studentId, studentData]) => {
        const userDetails = studentData.user_basic_detail || {};
        const totalScore = studentData.total_score?.[quizId] || 0;
        
        const row = {
          key: `${key}-${quizId}-${studentId}`,
          studentName: userDetails.student_name || '-',
          unitName: userDetails.unit_name || key,
          department: userDetails.department || '-',
          totalScore: parseFloat(totalScore) || 0,
          sectionDetail: {}
        };

        // Process section details and show actual scores
        const sectionDetail = studentData.quiz_detail?.[quizId]?.section_detail || {};
        Object.entries(sectionDetail).forEach(([sectionId, section]) => {
          row.sectionDetail[sectionId] = {
            ...section,
            calculated_score: section.section_total_score || '-',
            section_percentile_score: section.section_percentile_score || '-',
            unit_section_percentile_score: section.unit_section_percentile_score || '-'
          };
        });

        rows.push(row);
      });
    });

    return rows;
  }).flat();

  // Filter and sort data based on search term and sort order
  const filteredAndSortedData = [...processedData]
    .filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        item.studentName.toLowerCase().includes(searchLower) ||
        item.unitName.toLowerCase().includes(searchLower) ||
        item.department.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // First sort by search term match priority
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const aNameMatch = a.studentName.toLowerCase().includes(searchLower);
        const bNameMatch = b.studentName.toLowerCase().includes(searchLower);
        const aUnitMatch = a.unitName.toLowerCase().includes(searchLower);
        const bUnitMatch = b.unitName.toLowerCase().includes(searchLower);
        const aDeptMatch = a.department.toLowerCase().includes(searchLower);
        const bDeptMatch = b.department.toLowerCase().includes(searchLower);

        // Name matches come first
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        // Then unit matches
        if (aUnitMatch && !bUnitMatch) return -1;
        if (!aUnitMatch && bUnitMatch) return 1;
        
        // Then department matches
        if (aDeptMatch && !bDeptMatch) return -1;
        if (!aDeptMatch && bDeptMatch) return 1;
      }

      // Then apply total score sorting if specified
      if (sortOrder === 'none') return 0;
      if (sortOrder === 'asc') return a.totalScore - b.totalScore;
      return b.totalScore - a.totalScore;
    });

  // Get unique section names from all rows and map them to competency names
  const sectionNames = new Set();
  filteredAndSortedData.forEach(row => {
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
      <table className="competency-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Student Name</th>
            <th>Unit</th>
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
            {Array.from(sectionNames).map(sectionId => (
              <React.Fragment key={sectionId}>
                <th>{competencyMap[sectionId]} Score ({calculateTotalScore(sectionId)})</th>
                <th>{competencyMap[sectionId]} MH Percentile</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedData.map((row, index) => (
            <tr key={row.key}>
              <td>{index + 1}</td>
              <td>{row.studentName}</td>
              <td>{row.unitName}</td>
              <td>{row.department}</td>
              <td>{row.totalScore}</td>
              {Array.from(sectionNames).map(sectionId => (
                <React.Fragment key={sectionId}>
                  <td>{row.sectionDetail[sectionId]?.calculated_score || '-'}</td>
                  <td>{renderPercentileBar(row.sectionDetail[sectionId]?.section_percentile_score || '-')}</td>
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
