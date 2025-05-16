import React, { useState, useEffect } from 'react';
import './CompetencyTable.css';

const competencyMap = {
  "85": "Leadership",
  "83": "Quality in Healthcare Delivery",
  "84": "Relationship Building",
  "82": "Situation Management"
};

const competencyValues = {
  "85": "36",
  "83": "48",
  "84": "54",
  "82": "42"
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

const CompetencyMainTable = ({ data, isLoading }) => {
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

  useEffect(() => {
    if (data && data.status === 'success' && data.data) {
      console.log('Raw Data:', data.data); // Debug log
      
      // Detect which competencies are present in the current data
      const presentSectionIds = new Set();
      
      Object.values(data.data).forEach(unitData => {
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
        .filter(id => competencyMap[id])
        .map(id => ({ id, name: competencyMap[id] }));
      
      console.log('Active competencies:', activeCompetencyList);
      setActiveCompetencies(activeCompetencyList);
      
      processData();
    }
  }, [data, sortConfig]);

  const processData = () => {
    const rows = [];
    let sno = 1;

    Object.entries(data.data).forEach(([unitName, unitData]) => {
      console.log('Processing Unit:', unitName); // Debug log
      
      // Create a row for the unit
    const row = {
      sno: sno++,
      unitName,
        competencies: {},
        totalScore: 0
    };

      // Process score details
      const scoreDetail = unitData.score_detail;
      if (scoreDetail) {
    Object.entries(competencyMap).forEach(([sectionId, competencyName]) => {
      const compData = scoreDetail[sectionId] || {};
          row.competencies[competencyName] = {
            avg: compData.unit_section_score_average ?? '-',
            percentile: compData.unit_section_score_percentile ?? '-'
          };
          row.totalScore += parseFloat(compData.unit_section_score_average || 0);
        });
      }

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

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  if (!data || data.status !== 'success' || !data.data) {
    return <div className="no-data">No valid data provided.</div>;
  }

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
