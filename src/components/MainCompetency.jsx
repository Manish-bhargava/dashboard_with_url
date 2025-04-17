import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ClipLoader } from 'react-spinners';
import './shared.css';
import CompetencyMainTable from './CompetencyMainTable';
// import CompetencyTable from './CompetencyTable';

const MainCompetency = () => {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showTestsDropdown, setShowTestsDropdown] = useState(false);
  const [units, setUnits] = useState([]);
  const [quizList, setQuizList] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUnitList();
    fetchQuizList();
  }, []);

  const fetchUnitList = async () => {
    try {
      const res = await axios.post('/api/reportanalytics/getUnitList', {});
      if (res.data.status === 'success') {
        const allUnits = [...res.data.units.North, ...res.data.units.South];
        setUnits(allUnits);
      }
    } catch (err) {
      console.error('Error fetching unit list:', err);
    }
  };

  const fetchQuizList = async () => {
    try {
      const res = await axios.post('/api/reportanalytics/getQuizList', {});
      if (Array.isArray(res.data)) {
        setQuizList(res.data);
      }
    } catch (err) {
      console.error('Error fetching quiz list:', err);
    }
  };

  const handleUnitSelect = (unit) => {
    setSelectedUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
  };

  const handleTestSelect = (test) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const handleClear = () => {
    setSelectedUnits([]);
    setSelectedTests([]);
    setReportData(null);
  };

  const handleApply = async () => {
    if (selectedUnits.length === 0 || selectedTests.length === 0) {
      alert('Please select both Units and Tests.');
      return;
    }

    const selectedQuizIds = selectedTests
      .map((name) => {
        const quiz = quizList.find((q) => q.quiz_name === name);
        return quiz?.quiz_id || null;
      })
      .filter((id) => id);

    const requestBody = {
      unit: selectedUnits,
      quiz_id: selectedQuizIds,
    };

    try {
      setLoading(true);
      const response = await axios.post(
        '/api/reportanalytics/getMainCompetencyUnitReport',
        requestBody
      );

      if (response.data) {
        setReportData(response.data);
      } else {
        console.error('Invalid response data format:', response.data);
        alert('Received invalid data format from server.');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      alert('Error fetching report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!reportData) {
      alert('No data available to download.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, 'main_competency_report.xlsx');
    } catch (err) {
      console.error('Error downloading Excel:', err);
      alert('Error downloading Excel file. Please try again.');
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

      <div className="filters-row">
        {/* Units Dropdown */}
        <div className="dropdown-container">
          <div
            className="dropdown-header"
            onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}
          >
            <span>
              {selectedUnits.length
                ? `${selectedUnits.length} Units Selected`
                : 'Select Units'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={() =>
                    setSelectedUnits(
                      selectedUnits.length === units.length ? [] : [...units]
                    )
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

        {/* Tests Dropdown */}
        <div className="dropdown-container">
          <div
            className="dropdown-header"
            onClick={() => setShowTestsDropdown(!showTestsDropdown)}
          >
            <span>
              {selectedTests.length
                ? `${selectedTests.length} Tests Selected`
                : 'Select Tests'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showTestsDropdown && (
            <div className="dropdown-menu">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedTests.length === quizList.length}
                  onChange={() =>
                    setSelectedTests(
                      selectedTests.length === quizList.length
                        ? []
                        : quizList.map((q) => q.quiz_name)
                    )
                  }
                />
                Select All Tests
              </label>
              {quizList.map((quiz) => (
                <label key={quiz.quiz_id} className="dropdown-item">
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(quiz.quiz_name)}
                    onChange={() => handleTestSelect(quiz.quiz_name)}
                  />
                  {quiz.quiz_name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="button-group">
          
          <button className="apply-btn" style={{width: '120px'}} onClick={handleApply}>
            Apply
          </button>
          <button className="clear-btn" style={{width: '120px'}} onClick={handleClear}>
            Clear
          </button>
          <button className="excel-btn" style={{width: '120px'}} onClick={handleDownloadExcel}>
            Excel
          </button>
        </div>
      </div>

      <div className="report-content">
        <h2>Main Competency Unit Wise Report</h2>
        <p className="subtitle">Detailed analysis of main competency units</p>

        {loading ? (
          <div className="spinner-container">
            <ClipLoader color="blue" loading={loading} size={50} />
          </div>
        ) : reportData ? (
          <div className="results-content">
            <CompetencyMainTable data={reportData} />
          </div>
        ) : (
          <div className="no-filters-message">
            Please select filters and click "Apply" to view data.
          </div>
        )}
      </div>
    </div>
  );
};

export default MainCompetency;
