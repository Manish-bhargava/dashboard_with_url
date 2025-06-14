import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import './CompetencyTable.css';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Generate abbreviation from competency name
const getAbbreviation = (topicName) => {
  const words = topicName.split(/[ \/]+/);
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

const UnitSubCompetencyTable = ({ data, selectedCompetency, searchTerm, onDataUpdate }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'totalScore',
    direction: 'none'
  });
  const [topicMappings, setTopicMappings] = useState({});
  const [topicAbbreviations, setTopicAbbreviations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define helper functions first before they're used
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

  const safeValue = (val) =>
    val === null || val === undefined || val === '' ? '-' : val;

  const calculateTotalScore = (topicId) => {
    // Get the first unit's data
    const firstUnit = Object.values(reportData)[0];
    if (!firstUnit) return 0;

    // Get the first user's data that has section_detail
    const firstUser = Object.values(firstUnit).find(user => user.section_detail);
    if (!firstUser || !firstUser.section_detail) return 0;

    // Get the section that contains the topic
    const section = Object.values(firstUser.section_detail).find(section => 
      section.topic_detail && section.topic_detail[topicId]
    );
    if (!section) return 0;

    // Get the topic data
    const topic = section.topic_detail[topicId];
    if (!topic) return 0;

    // Calculate score using topic_total_question and correct_marks
    const correctMarks = parseFloat(section.correct_marks || 0);
    const totalQuestions = parseFloat(topic.topic_total_question || 0);
    
    if (!isNaN(correctMarks) && !isNaN(totalQuestions)) {
      const score = correctMarks * totalQuestions;
      return score.toFixed(1);
    }

    return 0;
  };

  const calculateTotalPossibleScore = () => {
    if (!reportData) return 0;
    let totalScore = 0;

    // Sum up all topic scores
    relevantTopics.forEach(({ topicId }) => {
      const score = calculateTotalScore(topicId);
      totalScore += parseFloat(score) || 0;
    });

    console.log('Total Possible Score:', totalScore);
    return totalScore.toFixed(1);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    if (sortConfig.direction === 'asc') return '↑';
    if (sortConfig.direction === 'desc') return '↓';
    return '↕️';
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'none') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'none' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Fetch topic mappings from API
  useEffect(() => {
    const fetchTopicMappings = async () => {
      try {
        console.log('Fetching topic mappings from API...');
        const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCompetency`, {});
        
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          const mappings = {};
          const abbreviations = {};
          
          response.data.data.forEach(section => {
            if (section.topics && Array.isArray(section.topics)) {
              section.topics.forEach(topic => {
                if (topic.topic_id && topic.topic_name) {
                  mappings[topic.topic_id] = [topic.topic_name, section.section_name];
                  abbreviations[topic.topic_id] = getAbbreviation(topic.topic_name);
                }
              });
            }
          });
          
          console.log('Generated topic mappings:', mappings);
          console.log('Generated abbreviations:', abbreviations);
          
          setTopicMappings(mappings);
          setTopicAbbreviations(abbreviations);
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        console.error('Error fetching topic mappings:', error);
        setError('Failed to load topic mappings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopicMappings();
  }, []);

  const reportData = data?.data || data;
  
  const relevantTopics = useMemo(() => {
    console.log('Calculating relevantTopics');
    const topics = Object.entries(topicMappings)
      .filter(([, [, comp]]) => comp === selectedCompetency)
      .map(([topicId, [name]]) => ({ topicId, name }));
    console.log('relevantTopics result:', topics);
    return topics;
  }, [selectedCompetency, topicMappings]);

  const tableRows = useMemo(() => {
    console.log('Calculating tableRows');
    if (!reportData || typeof reportData !== 'object') {
      console.log('Invalid reportData for tableRows');
      return [];
    }
    
    const rows = [];
    let sno = 1;

    Object.entries(reportData).forEach(([unitName, users]) => {
      if (!users || typeof users !== 'object') return;

      Object.entries(users).forEach(([userId, userData]) => {
        const basic = userData.user_basic_detail || {};
        const sectionDetails = userData.section_detail || {};
        const topicMap = {};

        Object.values(sectionDetails).forEach(section => {
          const topics = section.topic_detail || {};
          Object.entries(topics).forEach(([topicId, topic]) => {
            if (topicMappings[topicId]) {
              // Use the actual topic score from the data
              topicMap[topicId] = {
                score: topic.topic_total_score || '-',
                unitPercentile: topic.unit_topic_percentile_score,
                mhPercentile: topic.topic_percentile_score
              };
            }
          });
        });

        const totalScore = relevantTopics.reduce((acc, { topicId }) => {
          const raw = topicMap[topicId]?.score;
          const num = parseFloat(raw);
          return acc + (isNaN(num) ? 0 : num);
        }, 0);

        const row = {
          sno: sno++,
          studentName: basic.student_name || '-',
          unit: basic.unit_name || unitName,
          department: basic.department || '-',
          totalScore: totalScore ? totalScore.toFixed(1) : '-',
          topicMap
        };

        rows.push(row);
      });
    });

    console.log('tableRows result:', rows);
    return rows;
  }, [reportData, relevantTopics, topicMappings]);

  // First, define the filtered rows
  const filteredRows = useMemo(() => {
    console.log('🔍 Filtering rows with searchTerm:', searchTerm);
    if (!searchTerm) {
      console.log('📊 No search term, returning all rows');
      return tableRows;
    }
    const searchLower = searchTerm.toLowerCase();
    const filtered = tableRows.filter(row => 
      (row.unit && row.unit.toLowerCase().includes(searchLower)) ||
      (row.department && row.department.toLowerCase().includes(searchLower)) ||
      (row.studentName && row.studentName.toLowerCase().includes(searchLower))
    );
    console.log('📊 Filtered rows result:', filtered);
    return filtered;
  }, [tableRows, searchTerm]);

  // Then, define the sorted rows
  const sortedAndFilteredRows = useMemo(() => {
    console.log('🔄 Sorting rows with config:', sortConfig);
    let result = [...filteredRows];
    
    if (sortConfig.key && sortConfig.direction !== 'none') {
      result.sort((a, b) => {
        // Handle numeric columns like totalScore and topic scores
        if (sortConfig.key === 'totalScore') {
          const aValue = parseFloat(a.totalScore) || 0;
          const bValue = parseFloat(b.totalScore) || 0;
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }
        
        // Handle sort by S.No
        if (sortConfig.key === 'sno') {
          const aValue = parseInt(a.sno) || 0;
          const bValue = parseInt(b.sno) || 0;
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }
        
        // Handle string columns (studentName, unit, department)
        if (['studentName', 'unit', 'department'].includes(sortConfig.key)) {
          const aValue = String(a[sortConfig.key] || '').toLowerCase();
          const bValue = String(b[sortConfig.key] || '').toLowerCase();
          
          if (sortConfig.direction === 'asc') {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        }
        
        // Handle topic score sorting
        if (sortConfig.key.startsWith('score_')) {
          const topicId = sortConfig.key.replace('score_', '');
          const aValue = parseFloat(a.topicMap[topicId]?.score) || 0;
          const bValue = parseFloat(b.topicMap[topicId]?.score) || 0;
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }
        
        // Handle unit percentile sorting
        if (sortConfig.key.startsWith('unitPercentile_')) {
          const topicId = sortConfig.key.replace('unitPercentile_', '');
          const aValue = parseFloat(a.topicMap[topicId]?.unitPercentile) || 0;
          const bValue = parseFloat(b.topicMap[topicId]?.unitPercentile) || 0;
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }
        
        // Handle MH percentile sorting
        if (sortConfig.key.startsWith('mhPercentile_')) {
          const topicId = sortConfig.key.replace('mhPercentile_', '');
          const aValue = parseFloat(a.topicMap[topicId]?.mhPercentile) || 0;
          const bValue = parseFloat(b.topicMap[topicId]?.mhPercentile) || 0;
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }
        
        return 0;
      });
    }
    
    return result;
  }, [filteredRows, sortConfig]);

  // Update parent component when data changes - after sortedAndFilteredRows is defined
  useEffect(() => {
    if (onDataUpdate && sortedAndFilteredRows && sortedAndFilteredRows.length > 0) {
      // Create map of topic scores to pass to parent
      const topicScores = {};
      relevantTopics.forEach(({ topicId }) => {
        topicScores[topicId] = calculateTotalScore(topicId);
      });
      
      // Pass all the needed data for both table display and Excel export
      onDataUpdate({
        rows: sortedAndFilteredRows,
        topics: relevantTopics,
        abbreviations: topicAbbreviations,
        topicScores: topicScores,
        totalScore: calculateTotalPossibleScore()
      });
    }
  }, [sortedAndFilteredRows, relevantTopics, topicAbbreviations, onDataUpdate]);

  // Add effect to track component lifecycle
  useEffect(() => {
    console.log('🎯 Component mounted/updated');
    return () => {
      console.log('🧹 Component cleanup');
    };
  });

  // Early returns after all hooks
  if (!reportData || typeof reportData !== 'object') {
    console.log('❌ Invalid data structure');
    return <div className="no-data">No data available. Please check your selected filters and try again.</div>;
  }

  if (relevantTopics.length === 0) {
    console.log('❌ No relevant topics found');
    return <div className="no-data">No competency topics selected. Please select a competency to view the data.</div>;
  }

  if (filteredRows.length === 0) {
    console.log('❌ No filtered rows found');
    return (
      <div className="table-container">
        <div className="search-container">
          <input
            type="text"
            className="name-search-input"
            placeholder="Search by name, department, or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="no-data">No records found for student "{searchTerm}"</div>
      </div>
    );
  }

  console.log('🎨 Rendering table with rows:', sortedAndFilteredRows.length);

  return (
    <div className="table-container">
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading topic mappings...</div>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="search-container">
            <input
              type="text"
              className="name-search-input"
              placeholder="Search by name, department, or unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Legend for abbreviations */}
          <div className="competency-legend">
            <p><strong>Legend:</strong></p>
            <ul className="legend-list">
              {relevantTopics.map(({ topicId, name }) => (
                <li key={`${topicId}-${name}`}>
                  <strong>{topicAbbreviations[topicId]}</strong> - {name}
                </li>
              ))}
            </ul>
          </div>
<div className="table-wrapper">
  
<div style={{  overflowX: "auto", width: "100%" }}>

  <table className="competency-table">
    <thead>
      <tr>
        <th
          onClick={() => handleSort('sno')}
          style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
        >
          S.No
          <span style={{ marginLeft: '5px' }}>
            {getSortIcon('sno')}
          </span>
        </th>
        <th
          onClick={() => handleSort('studentName')}
          style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
        >
          Student Name
          <span style={{ marginLeft: '5px' }}>
            {getSortIcon('studentName')}
          </span>
        </th>
        <th
          onClick={() => handleSort('unit')}
          style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
        >
          Unit
          <span style={{ marginLeft: '5px' }}>
            {getSortIcon('unit')}
          </span>
        </th>
        <th
          onClick={() => handleSort('department')}
          style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
        >
          Department
          <span style={{ marginLeft: '5px' }}>
            {getSortIcon('department')}
          </span>
        </th>
        <th
          onClick={() => handleSort('totalScore')}
          style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
        >
          Total Score ({calculateTotalPossibleScore()})
          <span style={{ marginLeft: '5px' }}>
            {getSortIcon('totalScore')}
          </span>
        </th>
        {relevantTopics.map(({ topicId, name }) => {
          const abbr = topicAbbreviations[topicId];
          return (
            <React.Fragment key={name}>
              <th
                onClick={() => handleSort(`score_${topicId}`)}
                style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
              >
                {abbr} - Score ({calculateTotalScore(topicId)})
                <span style={{ marginLeft: '5px' }}>
                  {getSortIcon(`score_${topicId}`)}
                </span>
              </th>
              <th
                onClick={() => handleSort(`mhPercentile_${topicId}`)}
                style={{ cursor: 'pointer', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}
              >
                {abbr} - MH %ile
                <span style={{ marginLeft: '5px' }}>
                  {getSortIcon(`mhPercentile_${topicId}`)}
                </span>
              </th>
              <th
                onClick={() => handleSort(`unitPercentile_${topicId}`)}
                style={{ cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1 }}
              >
                {abbr} - Unit %ile
                <span style={{ marginLeft: '5px' }}>
                  {getSortIcon(`unitPercentile_${topicId}`)}
                </span>
              </th>
            </React.Fragment>
          );
        })}
      </tr>
    </thead>
    <tbody>
      {sortedAndFilteredRows.map((row, index) => (
        <tr key={row.sno}>
          <td>{index + 1}</td>
          <td>{safeValue(row.studentName)}</td>
          <td>{safeValue(row.unit)}</td>
          <td>{safeValue(row.department)}</td>
          <td>{safeValue(row.totalScore)}</td>
          {relevantTopics.map(({ topicId, name }) => (
            <React.Fragment key={name}>
              <td>{safeValue(row.topicMap[topicId]?.score)}</td>
              <td>{renderPercentileBar(row.topicMap[topicId]?.mhPercentile)}</td>
              <td>{renderPercentileBar(row.topicMap[topicId]?.unitPercentile)}</td>
            </React.Fragment>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>

</div>

        </>
      )}
    </div>
  );
};

export default UnitSubCompetencyTable;
