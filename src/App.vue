<template>
  <div class="subtitleSearch">
    <update></update>
    <div class="container">
      <div class="searchInput-container">
        <el-button type="success" @click="openDialog" :disabled="disabled"
          >添加字幕</el-button
        >
        <el-button type="primary" @click="getMovieList">电影列表</el-button
        ><br /><br />
        <el-input
          class="searchInput"
          v-model="searchParam"
          placeholder="请输入搜索关键字"
          @change="search"
          clearable
        >
          <el-button
            type="primary"
            slot="append"
            :icon="btnIcon"
            @click="search"
            >搜索</el-button
          >
        </el-input>
        <el-input
          class="excludeInput"
          v-model="excludeParam"
          placeholder="请输入排除关键字，如不需要则不填"
          clearable
        ></el-input>
        <el-switch
          v-model="strictMode"
          inactive-text="模糊搜索"
          active-text="精确搜索"
        >
        </el-switch>
      </div>
      <el-card class="box-card table-container">
        <el-input
          class="childSearchInput"
          v-model="childSearchParam"
          size="mini"
          placeholder="在当前结果中搜索"
          @change="childSearch"
          :disabled="childSearchDisabled"
        ></el-input>
        <el-table
          :data="
            tableData.slice(
              (currentPage - 1) * pageSize,
              currentPage * pageSize
            )
          "
          style="width: 100%"
          @expand-change="getContextData"
        >
          <el-table-column
            type="index"
            :index="indexMethod"
            width="60"
          ></el-table-column>
          <el-table-column prop="movie" label="电影名称"></el-table-column>
          <el-table-column prop="timeline" label="时间轴"></el-table-column>
          <el-table-column prop="subtitle" label="字幕内容">
            <template slot-scope="scope">
              <div style="white-space: pre-line">{{ scope.row.subtitle }}</div>
            </template>
          </el-table-column>
          <el-table-column type="expand">
            <template slot-scope="scope">
              <div
                class="subtitleRow"
                :class="scope.row.number === rowData.number ? 'currentRow' : ''"
                v-for="(rowData, i) in scope.row.contextData"
                :key="i"
              >
                {{ rowData.subtitle }}
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <div class="pagination-container">
        <el-pagination
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page.sync="currentPage"
          :page-sizes="[100, 200, 300, 400, 500, 10000]"
          :page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        >
        </el-pagination>
      </div>

      <el-dialog title="电影列表" :visible.sync="dialogVisible" width="60%">
        <el-row>
          <el-input
            v-model="movieSearchParam"
            size="mini"
            placeholder="请输入电影名"
            @change="searchMovie"
            style="width: 50%"
            clearable
          >
            <el-button
              type="primary"
              slot="append"
              icon="el-icon-search"
              @click="searchMovie"
              >搜索</el-button
            >
          </el-input>
          <el-button
            type="success"
            size="mini"
            @click="exportFile"
            style="margin-left: 20px"
            >导出</el-button
          >
          <span class="movieInfo"
            >电影总数：<span class="movieNum">{{
              movieList.length
            }}</span></span
          >
        </el-row>
        <div class="movieTableWrap">
          <el-table :data="movieListSearch" v-loading="movieListLoading">
            <el-table-column type="index" width="80"></el-table-column>
            <el-table-column prop="movie"></el-table-column>
          </el-table>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import { dialog } from "@electron/remote";
import { ipcRenderer } from "electron";
import getSubtitleJson from "./utils/subtitleUtil";
import invalidMovieList from "./utils/invalidMovieList";
import xlsx from "node-xlsx";
import fs from "fs";
import "lodash";
import update from "./components/update.vue";

export default {
  data() {
    return {
      searchParam: "",
      excludeParam: "",
      childSearchParam: "",
      movieSearchParam: "",
      childSearchDisabled: true,
      btnIcon: "el-icon-search",
      dbData: null,
      tableData: [],
      movieList: [],
      movieListSearch: [],
      pageSize: 300,
      currentPage: 1,
      total: 0,
      strictMode: false,
      dialogVisible: false,
      movieListLoading: true,
      db: null,
      // 添加字幕
      disabled: true,
    };
  },
  components: {
    update,
  },
  watch: {
    tableData: function (newVal) {
      if (newVal.length > 0) {
        this.childSearchDisabled = false;
      } else {
        this.childSearchDisabled = true;
      }
    },
  },
  methods: {
    openDialog() {
      let downloadPath = dialog.showOpenDialogSync({
        properties: ["openDirectory"],
      });
      if (downloadPath) {
        let filePath = downloadPath[0];
        let subtitleJson = getSubtitleJson(filePath);
        ipcRenderer
          .invoke("updateDB", subtitleJson)
          .then((res) => {
            if (res) this.$message.success("导入完成");
          })
          .catch((err) => {
            this.$message.error("Error: " + err);
          });
      }
    },
    indexMethod(index) {
      return index + 1 + (this.currentPage - 1) * this.pageSize;
    },
    handleSizeChange(val) {
      this.pageSize = val;
    },
    handleCurrentChange(val) {
      this.currentPage = val;
    },
    search: _.debounce(
      function () {
        if (this.searchParam !== "") {
          if (this.searchParam.length >= 3) {
            this.btnIcon = "el-icon-loading";
            this.childSearchParam = "";
            let searchParam = this.searchParam;
            let excludeParam = this.excludeParam;

            ipcRenderer
              .invoke("search", searchParam)
              .then((res) => {
                let searchData = res;
                searchData = searchData.filter((item) => {
                  return !invalidMovieList.includes(item.movie);
                });
                if (this.strictMode) {
                  let mappingArr = [
                    "\n",
                    "",
                    " ",
                    ",",
                    ".",
                    "，",
                    "。",
                    "?",
                    "？",
                    "!",
                    "！",
                    '"',
                    "-",
                  ];
                  searchData = searchData.filter((item) => {
                    let { subtitle } = item;
                    let searchParamIndex = subtitle
                      .toLowerCase()
                      .indexOf(searchParam.toLowerCase());
                    let ifPreSpace = mappingArr.includes(
                      subtitle.charAt(searchParamIndex - 1)
                    );
                    let ifNextSpace = mappingArr.includes(
                      subtitle.charAt(searchParamIndex + searchParam.length)
                    );
                    return ifPreSpace && ifNextSpace;
                  });
                }
                if (this.excludeParam) {
                  searchData = searchData.filter((item) => {
                    let { subtitle } = item;
                    return (
                      subtitle
                        .toLowerCase()
                        .indexOf(excludeParam.toLowerCase()) < 0
                    );
                  });
                }
                searchData.map((item, index) => {
                  item.contextData = [];
                  item.index = index;
                });
                this.tableData = searchData;
                this.total = searchData.length;
                this.btnIcon = "el-icon-search";
              })
              .catch((err) => {
                this.$message.error("查询错误，请联系管理员。 Error: " + err);
              });
          } else {
            this.$message.warning("为了避免过于卡顿，请至少输入3个字符");
          }
        }
      },
      1000,
      { leading: true, trailing: false }
    ),
    childSearch: _.debounce(
      function () {
        if (this.childSearchParam !== "") {
          let childSearchParam = this.childSearchParam;
          let tableData = this.tableData;

          this.tableData = tableData.filter((item) => {
            let { subtitle } = item;
            return (
              subtitle.toLowerCase().indexOf(childSearchParam.toLowerCase()) >=
              0
            );
          });
          this.total = this.tableData.length;
        }
      },
      1000,
      { leading: true, trailing: false }
    ),
    searchMovie() {
      if (this.movieSearchParam !== "") {
        let movieSearchParam = this.movieSearchParam;
        this.movieListSearch = this.movieList.filter((item) => {
          let { movie } = item;
          return (
            movie.toLowerCase().indexOf(movieSearchParam.toLowerCase()) >= 0
          );
        });
      } else {
        this.movieListSearch = this.movieList;
      }
    },
    getMovieList() {
      this.dialogVisible = true;
      if (!this.movieList.length) {
        ipcRenderer.invoke("movieListSearch").then((res) => {
          this.movieList = res;
          this.movieListSearch = this.movieList;
          this.movieListLoading = false;
        });
      }
    },
    exportFile() {
      let downloadPath = dialog.showOpenDialogSync({
        properties: ["openDirectory"],
      });
      if (downloadPath) {
        let data = this.movieList.map((val) => [val.movie]);
        let buffer = xlsx.build([{ name: "sheet1", data }]);
        fs.writeFile(downloadPath + "/movieList.xlsx", buffer, (err) => {
          if (err) throw err;
          this.$message.success("导出完成");
        });
      }
    },
    getContextData(row) {
      let { movie, number, contextData, index } = row;
      if (contextData && contextData.length === 0) {
        ipcRenderer
          .invoke("contextSearch", { movie, number })
          .then((res) => {
            this.tableData.map((item) => {
              if (index === item.index) {
                item.contextData = res;
              }
            });
          })
          .catch((err) => {
            this.$message.error("查询错误，请联系管理员。 Error: " + err);
          });
      }
    },
  },
};
</script>

<style lang="scss">
html,
body {
  margin: 0;
  padding: 0;
}
.subtitleSearch {
  box-sizing: border-box;
  padding: 20px;
  height: 100vh;
  .container {
    margin: 0 auto;
    width: 100%;
    height: calc(100% - 54px);
    .searchInput-container {
      width: 100%;
      margin-bottom: 20px;
      .searchInput {
        width: 50%;
        margin-right: 20px;
      }
      .excludeInput {
        width: 25%;
        margin-right: 20px;
      }
    }
    .table-container {
      max-height: calc(100% - 120px);
      overflow: auto;
      .childSearchInput {
        width: 200px;
        float: right;
      }
      .subtitleRow {
        width: 500px;
        white-space: pre-line;
        margin: 0 auto;
        margin-bottom: 10px;
        font-size: 14px;
        font-weight: bold;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .currentRow {
        color: #ff8600;
      }
    }
    .pagination-container {
      width: 100%;
      margin-top: 20px;
      text-align: center;
    }
    .movieTableWrap {
      height: 60vh;
      overflow: auto;
    }
    .movieInfo {
      font-size: 14px;
      line-height: 28px;
      float: right;
      margin-right: 20px;
      .movieNum {
        font-weight: bold;
      }
    }
  }
}
</style>
